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
      const url = `${this.apiUrl}/messages/email/send`;
      console.log(`[MessagingService] Sending email to: ${to}, template: ${template}, appId: ${appId ?? "(none)"}`);
      console.log(`[MessagingService] API URL: ${url}`);
      
      const payload: any = { to, template, context };
      if (appId) payload.appId = appId;

      console.log(`[MessagingService] Payload:`, JSON.stringify(payload, null, 2));

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-token": this.clientAppSecret || "",
        },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();
      console.log(`[MessagingService] Response status: ${response.status} ${response.statusText}`);
      console.log(`[MessagingService] Response body: ${rawText || "(empty)"}`);

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = rawText ? JSON.parse(rawText) : {};
        } catch {
          errorData = { message: rawText };
        }
        console.error(`[MessagingService] API Error Response:`, errorData);
        throw new Error(errorData.message || `Messaging API Error: ${response.statusText}`);
      }

      const result = rawText ? JSON.parse(rawText) : {};
      console.log(`[MessagingService] Success Result:`, result);
      return result;
    } catch (err) {
      console.error("[MessagingService] Catch Error:", err);
      throw new InternalServerErrorException(err instanceof Error ? err.message : "Unknown error in messaging");
    }
  }
}
