
// export function mapNaturalPersonByDocumentNumberResponse(
//   response: NaturalPersonByDocNumberSuccessResponse,
// ): NaturalPersonMappedResponse {
//   const legacyMapped = response as unknown as Partial<NaturalPersonMappedResponse>;
//   const customer = response.customers?.[0];
//   const person = customer?.person;
//   const personName = person?.personName;
//   const document = person?.document;

//   return {
//     status: customer?.status?.code ?? document?.state?.code ?? legacyMapped.status ?? '',
//     customerId: customer?.customerId ?? legacyMapped.customerId ?? '',
//     documentType: document?.documentTypeCode ?? legacyMapped.documentType ?? '',
//     documentNumber: document?.documentNumber ?? legacyMapped.documentNumber ?? '',
//     fullName: (personName?.fullName ?? [
//       personName?.givenName,
//       personName?.middleName,
//       personName?.lastName,
//       personName?.secondLastName,
//     ].filter(Boolean).join(' ')) || legacyMapped.fullName || '',
//     givenName: personName?.givenName ?? legacyMapped.givenName ?? '',
//     middleName: personName?.middleName ?? legacyMapped.middleName ?? '',
//     lastName: personName?.lastName ?? legacyMapped.lastName ?? '',
//     secondLastName: personName?.secondLastName ?? legacyMapped.secondLastName ?? '',
//     gender: legacyMapped.gender ?? '',
//     birthDate: person?.birthDate ?? legacyMapped.birthDate ?? '',
//     birthPlaceStateCode: legacyMapped.birthPlaceStateCode ?? '',
//     phoneNumber: person?.phoneNumber ?? legacyMapped.phoneNumber ?? null,
//     email: person?.emailAddress ?? legacyMapped.email ?? null,
//   };
// }

// export function mapNaturalPersonByCustomerIdResponse(
//   response: NaturalPersonByCustomerIdSuccessResponse,
// ): NaturalPersonMappedResponse {
//   const legacyMapped = response as unknown as Partial<NaturalPersonMappedResponse>;
//   const person = response.person;
//   const personName = person?.personName;
//   const primaryDocument = person?.documents?.[0];
//   const primaryContact = response.contactPoints?.[0];

//   return {
//     status: response.status?.code ?? primaryDocument?.state?.code ?? legacyMapped.status ?? '',
//     customerId: response.relatedParty?.partyId ?? legacyMapped.customerId ?? '',
//     documentType: primaryDocument?.documentTypeCode ?? legacyMapped.documentType ?? '',
//     documentNumber: primaryDocument?.documentNumber ?? legacyMapped.documentNumber ?? '',
//     fullName: (personName?.fullName ?? [
//       personName?.givenName,
//       personName?.middleName,
//       personName?.lastName,
//       personName?.secondLastName,
//     ].filter(Boolean).join(' ')) || legacyMapped.fullName || '',
//     givenName: personName?.givenName ?? legacyMapped.givenName ?? '',
//     middleName: personName?.middleName ?? legacyMapped.middleName ?? '',
//     lastName: personName?.lastName ?? legacyMapped.lastName ?? '',
//     secondLastName: personName?.secondLastName ?? legacyMapped.secondLastName ?? '',
//     gender: person?.genderCode ?? legacyMapped.gender ?? '',
//     birthDate: person?.birthDate ?? legacyMapped.birthDate ?? '',
//     birthPlaceStateCode: person?.placeOfBirth?.state?.code ?? legacyMapped.birthPlaceStateCode ?? '',
//     phoneNumber: primaryContact?.phoneAddress?.phoneNumber ?? person?.phoneNumber ?? legacyMapped.phoneNumber ?? null,
//     email: primaryContact?.electronicAddress?.emailAddress ?? person?.emailAddress ?? legacyMapped.email ?? null,
//   };
// }