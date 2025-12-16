import { IsIn } from 'class-validator';

export class ChangeRoleDto {
  @IsIn(['customer', 'admin', 'operator'], {
    message: 'role must be one of: customer, admin, operator',
  })
  role!: 'customer' | 'admin' | 'operator';
}
