# 基于Nixos和OpenWrt的内网DNS服务器配置

以下是在NixOS + OpenWRT环境中配置内网DNS服务器的总结，重点解决DNS解析（如`todo.nixos.com`）和相关服务（如Nginx）访问问题，确保内网设备（包括Windows、iPad等）可以通过域名访问服务。总结涵盖NixOS的BIND配置、OpenWRT的DNS转发、Nginx配置，以及处理Clash（Windows和OpenWRT）引起的DNS干扰问题。

---
为了让 NixOS 作为可靠的内网 DNS 服务器，需满足以下目标：
- **解析本地域名**：如 todo.nixos.com，返回内网 IP（如 192.168.86.186）。
- **解析外部域名**：通过上游 DNS（如 8.8.8.8、1.1.1.1）递归解析外部域名（如 cache.nixos.org）。
- **安全性**：限制递归查询到内网，防止外部滥用。
- **稳定性**：确保服务可靠运行，日志便于调试。
- **防止 resolv.conf 覆盖**：确保本地和内网设备优先使用你的 DNS 服务器。
---
## 配置内网DNS服务器的步骤

### 1. 配置NixOS的BIND服务
在NixOS上使用BIND（`named`）作为内网DNS服务器，解析自定义域名（如`*.nixos.com`）到内网IP（如`192.168.86.186`）。

**步骤**：
1. **编辑NixOS配置文件**：
   - 文件：`/etc/nixos/modules/services.nix`
   - 配置BIND服务：
```nix
{
	networking.firewall.enable = false; # 已禁用防火墙，排除干扰
	networking.resolvconf.enable = false; # 防止 resolv.conf 被覆盖
	networking.nameservers = [ "192.168.86.186" "8.8.8.8" ]; # 优先使用本地 DNS
	
	services.bind = {
	    enable = true;
	    listenOn = [ "192.168.86.186" "127.0.0.1" ];  # 监听DNS服务器的IP
	    listenOnIpv6 = [ ];  # 禁用IPv6
	    forwarders = [ "8.8.8.8" "1.1.1.1" ];  # 上游DNS
	    zones = [
	      {
	        name = "nixos.com";
	        master = true;
	        file = "/var/lib/bind/nixos.com.zone";
	      }
	    ];
	    extraOptions = ''
	        recursion yes;  # 启用递归查询
	        allow-recursion { 192.168.86.0/24; 127.0.0.1; };  # 允许递归查询的客户端
	        dnssec-validation auto; # 启用 DNSSEC
	    '';
	};
}
```
- 说明：
     - `listenOn`指定DNS服务器监听的IP。
     - `forwarders`定义外部域名解析的上游DNS。
     - `zones`定义本地域名（如`nixos.com`）的区域文件。
- 注意：
	- SERVFAIL 问题？
		BIND9 服务返回 SERVFAIL，主要是因为以下原因：
		- **区域名称不一致**：
			- 若在配置中，services.bind.zones.name = "nixos"，但区域文件路径为 /var/lib/bind/nixos.com.zone，且文件内容定义的是 nixos.com（SOA nixos.com.）。
			- BIND9 要求 zones.name 与区域文件中的域名完全一致。如果不一致，BIND9 无法正确加载区域文件，导致 SERVFAIL。
			- 当将 name 修改为 nixos.com 与区域文件保持一致后，BIND9 能够正确加载区域文件，解析问题解决。
		- **BIND9 配置问题**：
			- 若日志显示 named.conf:21: 'forward' redefined near 'forward'，表明 extraOptions 中的 forward first; 与 forwarders 冲突。NixOS 的 BIND9 模块会根据 forwarders 自动生成相关配置，重复定义导致服务启动失败。
			- 移除 forward first; 后，BIND9 配置恢复正常。
	- **可能的 DNSSEC 或网络问题**：
	    - dnssec-validation auto 要求 BIND9 能够访问 DNSSEC 根服务器。如果网络环境（如中国大陆的 GFW）限制了对根服务器或上游 DNS（如 8.8.8.8、1.1.1.1）的访问，可能导致外部域名解析失败（SERVFAIL）。 
1. **创建区域文件**：
   - 文件：`/var/lib/bind/nixos.com.zone`
   - 内容：
     ```zone
     $TTL    604800
     @       IN      SOA     nixos.com. admin.nixos.com. (
                                2         ; Serial
                           604800         ; Refresh
                            86400         ; Retry
                          2419200         ; Expire
                           604800 )       ; Negative Cache TTL
     ;
     @       IN      NS      ns.nixos.com.
     ns      IN      A       192.168.86.186
     *       IN      A       192.168.86.186  ; 所有*.nixos.com解析到192.168.86.186
     ```
   - 说明：通配符`* IN A 192.168.86.186`使所有子域名（如`todo.nixos.com`）解析到`192.168.86.186`。

3. **设置权限**：
   ```bash
   sudo chown named:named /var/lib/bind/nixos.com.zone
   sudo chmod 644 /var/lib/bind/nixos.com.zone
   sudo chown named:named /var/lib/bind -R
   sudo chmod 755 /var/lib/bind
   ```

4. **验证BIND配置**：
   - 检查区域文件：
     ```bash
     sudo named-checkzone nixos.com /var/lib/bind/nixos.com.zone
     ```
     应返回`OK`。
   - 检查BIND服务：
     ```bash
     sudo systemctl restart bind
     sudo systemctl status bind
     sudo journalctl -u bind.service -b
     ```
   - 测试DNS解析：
     ```bash
     nslookup todo.nixos.com 192.168.86.186
     ```
     应返回`192.168.86.186`。

5. **应用配置**：
   ```bash
   sudo nixos-rebuild switch
   ```

注意，`/etc/resolv.conf`修改为以下：
```bash
nameserver 192.168.86.186
nameserver 8.8.8.8
```

### 2. 配置NixOS的Nginx服务
Nginx用于处理域名请求（如`todo.nixos.com`），支持内网访问，并具备扩展性以支持未来添加新域名和端口。

**步骤**：
1. **编辑NixOS配置文件**：
   - 在`/etc/nixos/modules/services.nix`中配置Nginx：
     ```nix
     services.nginx = {
       enable = true;
       logError = "stderr debug";
       virtualHosts = {
         "todo.nixos.com" = {
           serverName = "todo.nixos.com";
           serverAliases = [ "localhost" "192.168.86.186" ];
           listen = [
             { addr = "0.0.0.0"; port = 80; }
           ];
           root = "/var/www/todo-list";
           extraConfig = ''
             index index.html;
           '';
           locations."/" = {
             tryFiles = "$uri $uri/ /index.html";
           };
           locations."/api/" = {
             proxyPass = "http://127.0.0.1:63343/api/";
             proxyWebsockets = true;
             extraConfig = ''
               proxy_set_header Host $host;
               proxy_set_header X-Real-IP $remote_addr;
               proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
               proxy_set_header X-Forwarded-Proto $scheme;
               proxy_connect_timeout 5s;
               proxy_read_timeout 10s;
               proxy_pass_header Access-Control-Allow-Origin;
               proxy_pass_header Access-Control-Allow-Methods;
               proxy_pass_header Access-Control-Allow-Headers;
             '';
           };
           locations."= /favicon.ico" = {
             extraConfig = ''
               return 204;
             '';
           };
         };
         # 扩展模板，未来可启用
         # "www.nixos.com" = {
         #   serverName = "www.nixos.com";
         #   listen = [{ addr = "0.0.0.0"; port = 8080; }];
         #   root = "/var/www/www-nixos";
         #   extraConfig = ''index index.html;'';
         #   locations."/" = { tryFiles = "$uri $uri/ /index.html"; };
         # };
       };
     };
     # 禁用防火墙
     networking.firewall.enable = false;
     ```
   - 说明：
     - `virtualHosts."todo.nixos.com"`定义`todo.nixos.com`监听80端口，代理API到后端（`127.0.0.1:63343`）。
     - 注释掉的`www.nixos.com`提供扩展模板，未来可复制添加新域名和端口。
     - 禁用防火墙以简化内网访问。

2. **创建网站目录**：
   ```bash
   sudo mkdir -p /var/www/todo-list
   sudo chown nginx:nginx /var/www/todo-list -R
   ```
   - 确保`/var/www/todo-list/index.html`存在。

3. **验证Nginx**：
   ```bash
   sudo nixos-rebuild switch
   sudo systemctl restart nginx
   sudo systemctl status nginx
   sudo netstat -tuln | grep 80
   sudo tail -f /var/log/nginx/access.log
   ```
   - 测试本地访问：
     ```bash
     curl -i http://todo.nixos.com
     curl -i http://todo.nixos.com/api/get-todos
     ```

### 3. 配置OpenWRT的DNS转发
OpenWRT作为网关，通过`dnsmasq`分发DNS服务器并转发本地域名（如`*.nixos.com`）到NixOS的DNS服务器（`192.168.86.186`）。

**步骤**：
1. **编辑`/etc/config/dhcp`**：
   ```bash
   vi /etc/config/dhcp
   ```

   ```bash
   config dnsmasq
       option domainneeded '1'
       option boguspriv '1'
       option localise_queries '1'
       option rebind_protection '1'
       option rebind_localhost '1'
       option local '/lan/'
       option domain 'lan'
       option expandhosts '1'
       option nonegcache '0'
       option cachesize '1000'
       option authoritative '1'
       option readethers '1'
       option leasefile '/tmp/dhcp.leases'
       option resolvfile '/tmp/resolv.conf.d/resolv.conf.auto'
       option nonwildcard '1'
       option localservice '1'
       option ednspacket_max '1232'
       option filter_aaaa '0'
       option filter_a '0'
       list server '/nixos.com/192.168.86.186'  # 转发*.nixos.com到NixOS DNS
       option localuse '0'

   config dhcp 'lan'
       option interface 'lan'
       option start '100'
       option limit '150'
       option leasetime '120h'
       option dhcpv4 'server'
       option dhcpv6 'server'
       option ra 'server'
       list ra_flags 'managed-config'
       list ra_flags 'other-config'
       list dhcp_option '6,192.168.86.186'  # 分发NixOS DNS

   config dhcp 'wan'
       option interface 'wan'
       option ignore '1'

   config odhcpd 'odhcpd'
       option maindhcp '0'
       option leasefile '/tmp/hosts/odhcpd'
       option leasetrigger '/usr/sbin/odhcpd-update'
       option loglevel '4'

   config host
       option name 'nixos'
       option ip '192.168.86.186'
       list mac '02:11:32:2D:F9:85'
   ```
   - 说明：
     - `list server '/nixos.com/192.168.86.186'`确保`*.nixos.com`请求转发到`192.168.86.186`。
     - `list dhcp_option '6,192.168.86.186'`分发NixOS DNS给客户端。

2. **重启dnsmasq**：
   ```bash
   /etc/init.d/dnsmasq restart
   ```

3. **验证DNS转发**：
   ```bash
   nslookup todo.nixos.com 192.168.86.1
   ```
   应返回：
   ```
   Server:         192.168.86.1
   Address:        192.168.86.1:53
   Name:   todo.nixos.com
   Address: 192.168.86.186
   ```

### 4. 处理Clash引起的DNS干扰
Clash（在Windows和OpenWRT上运行）可能通过`dns-hijack`拦截DNS请求，导致`*.nixos.com`解析失败（如`ERR_NAME_NOT_RESOLVED`）。

**OpenWRT Clash配置**：
- 文件：Clash配置文件
- 修改DNS部分：
  ```yaml
dns:
  enable: true
  listen: 0.0.0.0:53
  enhanced-mode: redir-host
  default-nameserver: [ 8.8.8.8, 114.114.114.114, 1.1.1.1 ]
  nameserver: [ https://dns.alidns.com/dns-query, https://223.5.5.5/dns-query ]
  fallback: [ 8.8.8.8, 114.114.114.114, 1.1.1.1 ]
  nameserver-policy:
    '*.nixos.com': '192.168.86.186' 
  fake-ip-filter:
    - '*.nixos.com' 
  skip-auth-prefixes: [ 127.0.0.1/32 ]
skip-auth-prefixes: [ 127.0.0.1/32 ]
tun:
  enable: true
  device: Mihomo
  stack: mixed
  auto-route: true
  auto-reua3f: false
  auto-detect-interface: true
  dns-hijack: [ any:53 ]
  route-exclude-address: []
  mtu: 1500
rules:
  - DOMAIN,cache.nixos.org,ua3f
  - DOMAIN-SUFFIX,fastly.net,ua3f
  ```
- **说明**：
  - `fake-ip-filter: ['*.nixos.com']`防止Clash为`*.nixos.com`分配虚拟IP（如`198.18.1.213`）。
  - `nameserver-policy: '*.nixos.com': '192.168.86.186'`强制`*.nixos.com`使用NixOS DNS。
- 重启Clash并测试：
  ```cmd
  nslookup todo.nixos.com
  curl -i http://todo.nixos.com
  ```

### 5. 配置客户端（如iPad）
- **检查DNS**：
  - 在iPad的Wi-Fi设置中，确认DNS为`192.168.86.186`。
  - 若失败，临时手动设置DNS为`192.168.86.186`：
    - 设置 > Wi-Fi > 网络 > DNS > 手动 > 添加`192.168.86.186`。
- **测试访问**：
  - 浏览器访问`http://todo.nixos.com`。
  - 如果有终端工具：
    ```bash
    curl -i http://todo.nixos.com
    ```

#### 6. 测试和验证
1. **NixOS服务器**：
   ```bash
   nslookup todo.nixos.com 192.168.86.186
   curl -i http://todo.nixos.com
   curl -i http://todo.nixos.com/api/get-todos
   ```

2. **OpenWrt：
   ```bash
   nslookup todo.nixos.com 192.168.86.1
   ```

3. **客户端（Windows/iPad）**：
   ```cmd
   nslookup todo.nixos.com
   curl -i http://todo.nixos.com
   ```
   - iPad通过浏览器访问`http://todo.nixos.com`。

4. **检查日志**：
   - NixOS：
     ```bash
     sudo journalctl -u bind.service -b
     sudo tail -f /var/log/nginx/access.log
     ```
   - OpenWRT：
     ```bash
     logread | grep dnsmasq
     ```

---

### 常见问题及解决办法
1. **DNS解析失败**：
   - **症状**：`nslookup todo.nixos.com`返回`NXDOMAIN`或错误IP（如`198.18.x.x`）。
   - **解决**：
     - 确保Clash配置包含`fake-ip-filter`和`nameserver-policy`。
     - 禁用OpenWRT Clash的`dns-hijack`或更改DNS监听端口。
     - 手动设置客户端DNS为`192.168.86.186`。

2. **Clash与dnsmasq冲突**：
   - **症状**：`dnsmasq`的转发规则失效。
   - **解决**：将Clash DNS端口改为`1053`或禁用Clash DNS。

3. **Nginx未响应**：
   - **症状**：`curl -i http://todo.nixos.com`返回`Empty reply from server`。
   - **解决**：
     - 检查Nginx日志：
       ```bash
       sudo tail -f /var/log/nginx/access.log
       sudo tail -f /var/log/nginx/error.log
       ```
     - 确保`serverName`和`listen`正确。

4. **iPad访问失败**：
   - **症状**：`ERR_NAME_NOT_RESOLVED`。
   - **解决**：
     - 手动设置iPad DNS为`192.168.86.186`。
     - 确保OpenWRT Clash跳过`*.nixos.com`。

---

### 总结
- **NixOS**：配置BIND解析`*.nixos.com`到`192.168.86.186`，Nginx处理`todo.nixos.com:80`并支持扩展。
- **OpenWRT**：配置`dnsmasq`分发`192.168.86.186`并转发`*.nixos.com`到NixOS DNS。
- **Clash**：在Windows和OpenWRT上配置`fake-ip-filter`和`nameserver-policy`跳过`*.nixos.com`，或禁用DNS劫持。
- **客户端**：确保DNS为`192.168.86.186`，验证域名访问。

通过以上步骤，内网DNS服务器应正常工作，Windows、iPad等设备可通过`todo.nixos.com`访问NixOS服务。如需扩展（如添加`www.nixos.com:8080`），复制Nginx的`virtualHosts`模板并启动对应服务即可。