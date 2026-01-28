import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductService } from './product.service';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // ! for creating product
  @Post('')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueName + extname(file.originalname));
        },
      }),
    }),
  )
  async addProduct(
    @Body() payload: CreateProductDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const imageUrl = `${process.env.APP_URL}/uploads/${file?.filename}`;

    const result = await this.productService.addProduct(payload, imageUrl);

    return {
      success: true,
      status: HttpStatus.CREATED,
      message: 'Product created successfully!!!',
      data: result,
    };
  }

  // ! for getting all product
  @Get('')
  async getAllProduct() {
    const result = await this.productService.getAllProduct();

    return {
      success: true,
      status: HttpStatus.OK,
      message: 'Product retrived successfully!!!',
      data: result,
    };
  }

  // ! for getting single product
  @Get(':id')
  async getSingleProduct(@Param('id') id: string) {
    const result = await this.productService.getSingleProduct(id);

    return {
      success: true,
      status: HttpStatus.OK,
      message: 'Product retrived successfully!!!',
      data: result,
    };
  }

  //
}
