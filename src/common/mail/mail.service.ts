import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    const mailPort = Number(this.config.get<number>("MAIL_PORT") || 587);
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>("MAIL_HOST"),
      port: mailPort,
      secure: mailPort === 465, // true for 465, false for 587
      auth: {
        user: this.config.get<string>("MAIL_USER"),
        pass: this.config.get<string>("MAIL_PASS")
      },
      // Zoho terkadang butuh pengaturan TLS tambahan untuk port 587
      tls: {
        rejectUnauthorized: false // Membantu jika ada masalah sertifikat di server
      },
      debug: true,
      logger: true
    });
  }

  private getFromHeader(): string {
    const name = this.config.get<string>("MAIL_FROM");
    const user = this.config.get<string>("MAIL_USER");
    if (name) {
      return `${name} <${user}>`;
    }
    return user!;
  }

  async sendProductEmail(to: string, order: any) {
    const isBook = order.kind === "book";
    const itemsHtml = order.order_items
      .map(
        (item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.title}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.quantity} x IDR ${item.unit_price.toLocaleString()}</td>
      </tr>
    `
      )
      .join("");

    const subject = isBook ? `[Download] ${order.order_items[0].title}` : `[Konfirmasi] Pesanan Kursus ${order.order_items[0].title}`;

    const content = isBook
      ? `
      <p>Terima kasih atas pembelian Anda! Berikut adalah link akses eBook Anda:</p>
      <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
        <a href="https://course.bagdja.com/my-products" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Akses eBook Sekarang</a>
      </div>
      <p>Atau Anda bisa mengunduh langsung melalui dashboard profil Anda.</p>
    `
      : `
      <p>Pendaftaran kursus Anda telah berhasil dikonfirmasi!</p>
      <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <strong>Detail Kursus:</strong><br>
        Judul: ${order.order_items[0].title}<br>
        Status: Terkonfirmasi<br>
        Langkah Selanjutnya: Tim kami akan menghubungi Anda melalui WhatsApp/Email untuk instruksi pengerjaan kelas.
      </div>
    `;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #000;">Halo, Terima kasih atas pesanannya!</h2>
        <p>Pembayaran Anda untuk Order <strong>#${order.id.slice(0, 8)}</strong> telah kami terima.</p>
        
        ${content}

        <h3 style="border-bottom: 2px solid #000; padding-bottom: 5px; margin-top: 30px;">Ringkasan Transaksi</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9f9f9;">
              <th style="padding: 8px; text-align: left;">Item</th>
              <th style="padding: 8px; text-align: right;">Harga</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Total Pembayaran (Lunas)</td>
              <td style="padding: 8px; font-weight: bold; text-align: right;">IDR ${order.total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <p style="margin-top: 40px; font-size: 12px; color: #777; border-top: 1px solid #eee; pt: 20px;">
          Ini adalah email otomatis, mohon tidak membalas email ini. Jika ada pertanyaan, silakan hubungi support@bagdja.com
        </p>
      </div>
    `;

    try {
      const info = await this.transporter.sendMail({
        from: this.getFromHeader(),
        to,
        subject,
        html
      });
      console.log("Email sent successfully:", info.messageId);
      return info;
    } catch (err) {
      console.error("DETAILED MAIL ERROR:", err);
      throw err;
    }
  }
}
