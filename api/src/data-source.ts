import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'unistay_secret_2026',
  database: process.env.DB_DATABASE || 'unistay_db',
  entities: [`${__dirname}/**/*.entity{.ts,.js}`],
  migrations: [`${__dirname}/database/migrations/*{.ts,.js}`],
  synchronize: false,
});

export default dataSource;
