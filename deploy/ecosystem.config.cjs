// PM2 設定。/opt/3dp-workshop/.env を読み込む (Node 20+ の --env-file)。
module.exports = {
  apps: [
    {
      name: "3dp-workshop",
      cwd: "/opt/3dp-workshop",
      script: "server.js",
      node_args: "--env-file=/opt/3dp-workshop/.env",
      env: {
        NODE_ENV: "production",
        PORT: "8010",
        HOSTNAME: "127.0.0.1",
      },
      max_memory_restart: "400M",
      instances: 1, // レート制限がメモリ内のため単一プロセス
      exec_mode: "fork",
      autorestart: true,
    },
  ],
};
