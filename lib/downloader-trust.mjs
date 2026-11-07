import {existsSync} from 'node:fs';
export function certificateBundle(env=process.env,platform=process.platform,exists=existsSync){
 if(env.SSL_CERT_FILE){if(!exists(env.SSL_CERT_FILE))throw Error('The configured SSL_CERT_FILE does not exist. Configure a valid CA certificate bundle.');return env.SSL_CERT_FILE;}
 const paths=platform==='darwin'?['/etc/ssl/cert.pem']:platform==='linux'?['/etc/ssl/certs/ca-certificates.crt','/etc/pki/tls/certs/ca-bundle.crt']:[];
 return paths.find(exists)||'';
}
export function downloaderTrust(flags={},options={}){
 const env={...process.env,...options.env},ca=certificateBundle(env);
 const compat=flags.compatOptions?Array.isArray(flags.compatOptions)?flags.compatOptions:String(flags.compatOptions).split(','):[];
 return {flags:{...flags,...(ca?{compatOptions:[...new Set([...compat,'no-certifi'])]}:{})},options:{...options,env:{...env,...(ca?{SSL_CERT_FILE:ca,REQUESTS_CA_BUNDLE:ca,CURL_CA_BUNDLE:ca}:{})}}};
}
