import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from './user.entity';


@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'text', unique: true })
  code: string; // "admin" | "blogger"

  @Column({ type: 'text' })
  name: string;

  @OneToMany(() => User, (u) => u.role)
  users: User[];
}
