# @bagdja/node-sdk

SDK resmi untuk integrasi layanan Bagdja Platform pada aplikasi Node.js (khususnya NestJS). SDK ini menyediakan fitur keamanan (Guard) dan sistem logging terpusat secara *Zero-Config*.

## Fitur Utama

- **ClientAppGuard**: Proteksi endpoint menggunakan `x-api-token` atau `Authorization Bearer`.
- **BagdjaLogger**: Wrapper Logger NestJS yang otomatis mengirim log ke Bagdja Log Service secara *non-blocking*.
- **Zero Config**: Deteksi otomatis konfigurasi melalui Environment Variables.

## Instalasi

```bash
npm install @bagdja/node-sdk
```

Pastikan peer dependencies sudah terinstall di project Anda:
```bash
npm install @nestjs/common @nestjs/core reflect-metadata rxjs
```

## Konfigurasi

Tambahkan variabel berikut di file `.env` aplikasi Anda:

```env
# URL Layanan Bagdja
BAGDJA_AUTH_URL=https://auth.bagdja.com
BAGDJA_LOG_URL=https://log.bagdja.com

# Identitas Aplikasi (Opsional jika di-inject via module)
BAGDJA_SERVICE_NAME=nama-service-anda
```

## Cara Penggunaan

### 1. Registrasi Module

Daftarkan `BagdjaModule` di `AppModule` Anda:

```typescript
import { BagdjaModule } from '@bagdja/node-sdk';

@Module({
  imports: [
    BagdjaModule.register({
      isGlobal: true,
      auth: {
        authServiceUrl: process.env.BAGDJA_AUTH_URL,
      },
      logger: {
        logServiceUrl: process.env.BAGDJA_LOG_URL,
        serviceName: 'my-awesome-service',
      },
    }),
  ],
})
export class AppModule {}
```

### 2. Menggunakan Guard

Gunakan `@UseGuards(ClientAppGuard)` untuk melindungi endpoint:

```typescript
import { ClientAppGuard } from '@bagdja/node-sdk';

@Controller('data')
export class DataController {
  @Get()
  @UseGuards(ClientAppGuard)
  findAll() {
    return "This is protected data";
  }
}
```

### 3. Menggunakan Logger

Gunakan `BagdjaLogger` untuk logging otomatis ke dashboard:

```typescript
import { BagdjaLogger } from '@bagdja/node-sdk';

@Injectable()
export class MyService {
  constructor(private readonly logger: BagdjaLogger) {
    this.logger.init('MyService'); // Inisialisasi context
  }

  doSomething() {
    this.logger.log('Sedang memproses data...', { tags: ['process'] });
    
    try {
      // logic
      this.logger.success('Proses berhasil!', { data: { id: 123 } });
    } catch (err) {
      this.logger.fail('Proses gagal', { error: err.message });
    }
  }
}
```

## Lisensi
MIT
