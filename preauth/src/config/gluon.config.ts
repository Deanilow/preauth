// This code allows to set up a gluon application
// Be carefully, change this code only if you know what you are doing
const GLUON = 'GLUON';
// Observability configuration
process.env.DARWIN_CORE_EXCEPTIONS_ERRROR_FORMAT = GLUON;
process.env.DARWIN_LOGGING_FORMAT = GLUON;
process.env.DARWIN_LOGGING_COMPANY = 'sur';
process.env.DARWIN_LOGGING_COMPANY_COMPONENT_NAME = 'funinttraapi';
process.env.DARWIN_LOGGING_COMPANY_COMPONENT_ID = '';
process.env.DARWIN_LOGGING_COMPANY_COMPONENT_TYPE = 'microservice';
process.env.DARWIN_LOGGING_COMPANY_APP_NAME = 'appcli';
process.env.DARWIN_LOGGING_COMPANY_APP_ID = '';
process.env.COMPONENT_VERSION = process.env.npm_package_version;
// Error handling configuration
process.env.DARWIN_CORE_EXCEPTIONS_ERROR_FORMAT = GLUON;
process.env.DARWIN_LOGGING_FORMAT = GLUON;
process.env.DARWIN_APPKEY = 'appcli';