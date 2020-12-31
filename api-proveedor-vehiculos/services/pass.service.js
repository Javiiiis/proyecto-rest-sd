'use strict'

// Devuelve un hash con salt incluido en el formato
//
// $2b$10$M79bnlHRR.Et0Z2qr0L0TucfAt3Sl.tWaeIGMBml4G7ZlNgexm06.
// ----***----------*******************************************
// Alg Cost         Salt                 Hash
//

const bcrypt = require('bcrypt');

function encriptaPassword(password)
{
    return bcrypt.hash(password, 10);
}

// Devuelve truee o false
function comparaPassword(password, hash)
{
    return bcrypt.compare(password, hash);
}

module.exports = {
    encriptaPassword,
    comparaPassword
}