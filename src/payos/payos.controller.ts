import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { PayosService } from './payos.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  PaymentResponseDto,
  WebhookResponseDto,
} from './dto/payment-response.dto';

@ApiTags('PayOS Payment')
@Controller('payos')
export class PayosController {
  private readonly logger = new Logger(PayosController.name);

  constructor(private readonly payosService: PayosService) {}

  @Post('create-payment-link')
  @ApiOperation({ summary: 'Create a payment link' })
  @ApiResponse({
    status: 201,
    description: 'Payment link created successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async createPaymentLink(
    @Body() createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentResponseDto> {
    this.logger.log(
      `Creating payment link for amount: ${createPaymentDto.amount}`,
    );
    return this.payosService.createPaymentLink(createPaymentDto);
  }

  @Get('payment-info/:orderCode')
  @ApiOperation({ summary: 'Get payment information by order code' })
  @ApiResponse({
    status: 200,
    description: 'Payment information retrieved successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async getPaymentInformation(
    @Param('orderCode') orderCode: number,
  ): Promise<PaymentResponseDto> {
    this.logger.log(`Getting payment information for order: ${orderCode}`);
    return this.payosService.getPaymentInformation(orderCode);
  }

  @Post('cancel-payment/:orderCode')
  @ApiOperation({ summary: 'Cancel a payment by order code' })
  @ApiResponse({
    status: 200,
    description: 'Payment cancelled successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async cancelPayment(
    @Param('orderCode') orderCode: number,
  ): Promise<PaymentResponseDto> {
    this.logger.log(`Cancelling payment for order: ${orderCode}`);
    return this.payosService.cancelPayment(orderCode);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle PayOS webhook notifications' })
  @ApiHeader({
    name: 'PayOS-Signature',
    description: 'Webhook signature for verification',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    type: WebhookResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async handleWebhook(@Body() webhookData: any): Promise<WebhookResponseDto> {
    this.logger.log('Received webhook notification');
    this.logger.log('Webhook data: ', webhookData);
    try {
      // Verify webhook data using PayOS method
      const verifiedData =
        await this.payosService.verifyWebhookData(webhookData);

      // Process webhook with verified data
      return this.payosService.handleWebhook(verifiedData);
    } catch (error) {
      this.logger.warn('Invalid webhook data received', error);
      return {
        success: false,
        message: 'Invalid webhook data',
      };
    }
  }
}
