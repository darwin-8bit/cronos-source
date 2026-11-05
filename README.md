# cronos-source

Purpose: Create a 3D interactive globe that allows the user to take notes based on whichever country the select. I wanted something for my own personal use that I could have on hand to jot down notes with regards to each countries financial sectors, population numbers, and other important information. 

**IMPORTANT**
Run Before cloning repository within your terminal

`mkdir -p /opt`  

`cd /opt`  

`git clone https://github.com/darwin-8bit/cronos-source.git`  

Run following script after cloning repository. 

`apt install -y curl`  
`curl -fsSL https://deb.nodesource.com/setup_22.x \
  -o /tmp/nodesource_setup.sh`

`bash /tmp/nodesource_setup.sh`

`apt install -y nodejs`

`cd /opt/cronos-source`  

`nmp ci`  

`npm run build`  

`apt update`  

`apt install -y nginx`  

`systemctl enable nginx`  

`hostname -I`

`systemctl status nginx`

`curl -I http://localhost`  

`cat > /etc/nginx/sites-available/cronos <<'EOF'`  

 `server {` 
 
    listen 80;  
    
    server_name _;'`

    root /opt/cronos-source/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|svg|ico|woff2)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
`}
EOF`

`ln -sf /etc/nginx/sites-available/cronos \`
`/etc/nginx/sites-enabled/cronos`

`rm -f /etc/nginx/sites-enabled/default`

`nginx -t && systemctl reload nginx`
