import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Operator, OperatorStatus } from '../entities/operator.entity';
import { CreateOperatorDto } from './dto/create-operator.dto';
import { UpdateOperatorDto } from './dto/update-operator.dto';

@Injectable()
export class OperatorService {
  constructor(
    @InjectRepository(Operator)
    private operatorRepository: Repository<Operator>,
  ) {}

  async create(createOperatorDto: CreateOperatorDto): Promise<Operator> {
    // Check if operator with same email already exists
    const existingOperator = await this.operatorRepository.findOne({
      where: { contactEmail: createOperatorDto.contactEmail },
    });

    if (existingOperator) {
      throw new ConflictException('Operator with this email already exists');
    }

    const operator = this.operatorRepository.create(createOperatorDto);
    
    // Set approved_at if status is approved
    if (createOperatorDto.status === OperatorStatus.APPROVED) {
      operator.approvedAt = new Date();
    }

    return this.operatorRepository.save(operator);
  }

  async findAll(): Promise<Operator[]> {
    return this.operatorRepository.find({
      relations: ['buses', 'routes'],
    });
  }

  async findOne(id: string): Promise<Operator> {
    const operator = await this.operatorRepository.findOne({
      where: { id },
      relations: ['buses', 'routes'],
    });

    if (!operator) {
      throw new NotFoundException(`Operator with ID ${id} not found`);
    }

    return operator;
  }

  async update(id: string, updateOperatorDto: UpdateOperatorDto): Promise<Operator> {
    const operator = await this.findOne(id);

    // Check if email is being updated and if it conflicts with existing operator
    if (updateOperatorDto.contactEmail && updateOperatorDto.contactEmail !== operator.contactEmail) {
      const existingOperator = await this.operatorRepository.findOne({
        where: { contactEmail: updateOperatorDto.contactEmail },
      });

      if (existingOperator) {
        throw new ConflictException('Operator with this email already exists');
      }
    }

    // Update approvedAt if status is being set to approved
    if (updateOperatorDto.status === OperatorStatus.APPROVED && operator.status !== OperatorStatus.APPROVED) {
      operator.approvedAt = new Date();
    }

    Object.assign(operator, updateOperatorDto);
    return this.operatorRepository.save(operator);
  }

  async remove(id: string): Promise<void> {
    const operator = await this.findOne(id);
    await this.operatorRepository.remove(operator);
  }

  async findByStatus(status: OperatorStatus): Promise<Operator[]> {
    return this.operatorRepository.find({
      where: { status },
      relations: ['buses', 'routes'],
    });
  }

  async approveOperator(id: string): Promise<Operator> {
    return this.update(id, { status: OperatorStatus.APPROVED });
  }

  async suspendOperator(id: string): Promise<Operator> {
    return this.update(id, { status: OperatorStatus.SUSPENDED });
  }
}
