// pm2 process for the live site. Node 22 is installed in /opt/node22 so the
// server's other apps keep their own Node version. Next.js reads .env itself.
module.exports = {
  apps: [
    {
      name: "anlima",
      cwd: "/var/www/anlima",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3100 -H 127.0.0.1",
      interpreter: "/opt/node22/bin/node",
      env: {
        NODE_ENV: "production",
        PATH: "/opt/node22/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      },
      max_memory_restart: "1G",
    },
  ],
};
