'use strict'

const port = process.env.PORT || 3005;

const https = require('https');
const express = require('express');
const logger = require('morgan');
const mongojs = require('mongojs');
const fs = require('fs');
const Token = require('./services/token.service');
const doc = require('./documentacion.json');

const opciones = {
    key: fs.readFileSync('./cert/key.pem'),
    cert: fs.readFileSync('./cert/cert.pem')
};

const app = express();

// Declaramos los middleware
app.use(logger('dev'));
app.use(express.urlencoded({extended: false}));
app.use(express.json());

// Autorización tipo bearer token
function auth(req, res, next) {
    if (!req.headers.authorization){ //Mirar si en la cabecera hay un token.
        res.status(403).json({
            result: 'KO',
            mensajes: "No has enviado el token en la cabecera."
        });
        return next();
    }
    const queToken = req.headers.authorization.split(" ")[1]; // token en formato JWT
    Token.decodificaToken(queToken)
    .then(userID => {
        return next();
    })
    .catch(err => {
        res.status(403).json({
            result: 'KO',
            mensajes: "Acceso no autorizado a este servicio."
        });
        return next(new Error("Acceso no autorizado a este servicio."));
    })
}

//Documentación
app.get('/api/docs', (req, res, next) => {
    res.status(200).json({
        item : doc.item
    });
});

// Rutas y Controladores.

// Implementamos el API RESTFul a través de los métodos

app.get('/api/payment', auth, (req, res, next) => {
    const random = Math.random() * (100-0);
    var payment = (random >=0 && random <= 80) ? true:false;

    if(payment) {
        res.status(200).json({ 
            pago: payment,
            message: "Pago realizado"
        })
    }
    else {
        res.status(400).json({ 
            pago: payment,
            message: "Pago no relizado"
        })
    }
});

https.createServer(opciones, app). listen(port, () => {
    console.log(`API WS Pagos ejecutándose en https://localhost:${port}/api/{pagos}`);
});

// app.listen(port, () => {
//     console.log(`API RESTful CRUD ejecutándose en http://localhost:${port}/api/{reservas}/{id}`);
// });