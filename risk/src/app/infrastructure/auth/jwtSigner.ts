// import jwt from "jsonwebtoken";
// import { DigitalTokenSignerOutputPort } from "../../application/ports/output/digital-token.port";
// import { BusinessError } from "src/shared/errors/integration.error";

// export class JwtSigner implements DigitalTokenSignerOutputPort {

//   constructor(
//     private readonly privateKey: string,
//     private readonly kid: string
//   ) {}

//   async sign(payload: object): Promise<string> {
//     try {
//       return jwt.sign(payload, this.privateKey, {
//         algorithm: "RS256",
//         expiresIn: "120s",
//         keyid: this.kid
//       });
//     } catch (error) {
//       throw new BusinessError(
//         "TOKEN_GENERATION_FAILED",
//         "Error al generar token"
//       );
//     }
//   }
// }