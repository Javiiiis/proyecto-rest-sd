'use strict'

const jwt = require('jwt-simple');
const moment = require('moment');

const SECRET = require('../config').SECRET;
const EXP_TIME = require('../config').TOKEN_EXP_TIME;

// CrearToken
//
// Devuelve un token tipo JWT
// Formato JWT:
//  HEADER.PAYLOAD.VERIFY_SIGNATURE
//
// Donde:
//      HEADER ( OBJETO JSON con algorimto y ... codificado en formato base64Url)
//          {
//              "typ"
//...
//      VERIFY_SIGNATURE:
//          HMACSHA256( base64UrlEncode(HEADER) + "." + base64UrlEncode(PAYLOAD), SECRET )
//
//
function creaToken(user){
    const payload = {
        sub: user._id,
        iat: moment().unix(),
        exp: moment().add(EXP_TIME, 'minutes').unix()
    };
    return jwt.encode( payload, SECRET );
}

function decodificaToken(token){
    return new Promise( (resolve, reject) => {
        try {
            const payload = jwt.decode(token, SECRET, true);
            if(payload.exp <= moment().unix()){
                reject( {
                    status: 401,
                    message: 'El token ha experido'
                });
            }
            resolve( payload.sub);
        } catch (err) {
            reject({
                status: 500,
                message: 'El token no es válido',
                err: err
            })
        }
    });
}

module.exports = {
    creaToken,
    decodificaToken
};

