import { DataSource } from 'typeorm';

export interface Seed {
  run(dataSource: DataSource): Promise<void>;
}
