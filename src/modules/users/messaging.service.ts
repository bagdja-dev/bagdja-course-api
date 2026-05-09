import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class MessagingService {
  private readonly apiUrl: string;
  private readonly clientAppSecret: string;

  constructor(private readonly config: ConfigService) {
    this.apiUrl = this.config.get<string>("BAGDJA_MESSAGE_API") || "https://message.bagdja.com";
    this.clientAppSecret = this.config.get<string>("CLIENT_APP_SECRET") || "";
  }

  async sendEmail(to: string, template: string, context: any, appId?: string) {
    try {
      console.log(`[MessagingService] Sending email to: ${to}, template: ${template}`);
      console.log(`[MessagingService] API URL: ${this.apiUrl}/messages/email/send`);
      
      const payload: any = { to, template, context };
      if (appId) payload.appId = appId;

      console.log(`[MessagingService] Payload:`, JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.apiUrl}/messages/email/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-token": this.clientAppSecret || "",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[MessagingService] API Error Response:`, errorData);
        throw new Error(errorData.message || `Messaging API Error: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[MessagingService] Success Result:`, result);
      return result;
    } catch (err) {
      console.error("[MessagingService] Catch Error:", err);
      throw new InternalServerErrorException(err instanceof Error ? err.message : "Unknown error in messaging");
    }
  }
}
