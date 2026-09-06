/* eslint-disable @typescript-eslint/no-unused-vars */
import routerTokens from './tokens';

interface PrefixedRouter {
  route: (app, opts, callback) => void;
  prefix: string;
}

/**
* Array of routes
* Routes are stored in an array with its prefix
* It is later used on the app composer
*/
const router: Array<PrefixedRouter> = [
  {
    route: routerTokens,
    prefix: ''
  }
];

/**
 * @returns routes.
 */
export = router;
