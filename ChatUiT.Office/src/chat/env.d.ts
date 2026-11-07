/** Set by webpack's DefinePlugin from environments.js. */
declare const CHATUIT_API_ORIGIN: string;
/** The servers a development build can switch between, by name. Null in a production build. */
declare const CHATUIT_DEV_API_HOSTS: Readonly<Record<string, string>> | null;
/** The commit the add-in was built from. */
declare const CHATUIT_APP_VERSION: string;
