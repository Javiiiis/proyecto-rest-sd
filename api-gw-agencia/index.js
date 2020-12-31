'use strict'

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const port = process.env.PORT || 3000;

const express = require('express');
const logger = require('morgan');
const fetch = require('node-fetch');
const fs = require('fs');
const https = require('https');

const Token = require('./services/token.service');

const opciones = {
    key: fs.readFileSync('./cert/key.pem'),
    cert: fs.readFileSync('./cert/cert.pem')
};

const URL_WS_users = "https://localhost:3002";
const URL_WS_transacciones = "https://localhost:3100/api"

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

// Rutas y Controladores.
// Implementamos el API RESTFul a través de los métodos

// Listar vuelos
app.get('/api/listarVuelos', (req, res, next) => {

    const queURL = `${URL_WS_transacciones}/vuelo/Ofertas`;

    //Cliente de mi WS (web service).
    fetch(queURL)
        .then(res => res.json())
        .then(json => {
        //Mi lógica de negocio...
        res.json({
            result: 'OK',
            reserva: 'vuelos',
            Elementos: json.Elementos
        });
    });
});

// Listar Vehiculos
app.get('/api/listarVehiculos', (req, res, next) => {

    const queURL = `${URL_WS_transacciones}/vehiculo/Ofertas`;

    //Cliente de mi WS (web service).
    fetch(queURL)
        .then(res => res.json())
        .then(json => {
        //Mi lógica de negocio...
        res.json({
            result: 'OK',
            reserva: 'vehiculos',
            Elementos: json.Elementos
        });
    });
});

// Listar Hoteles
app.get('/api/listarHoteles', (req, res, next) => {

    const queURL = `${URL_WS_transacciones}/hotel/Ofertas`;

    //Cliente de mi WS (web service).
    fetch(queURL)
        .then(res => res.json())
        .then(json => {
        //Mi lógica de negocio...
        res.json({
            result: 'OK',
            reserva: 'hoteles',
            Elementos: json.Elementos
        });
    });
});

// Registro & Login
app.post('/api/auth/:user', (req, res, next) => {
    const nuevoElemento = req.body;
    const queToken = req.headers.authorization.split(" ")[1];
    const queAccion = req.params.user;
    const queURL = `${URL_WS_users}/${queAccion}`;
    
    //Cliente de mi WS (web service).
    fetch(queURL,   {
                        method: 'POST',
                        body: JSON.stringify(nuevoElemento), // Serializar
                        headers: {
                                    'Content-Type': 'application/json'
                                 }
                    })
        .then(res => res.json())
        .then(json => {
            //Mi lógica de negocio...
            res.json({
                result: 'OK',
                Usuarios: "users",
                respuesta: json
            });
        }
    )
});

// Reservar (hotel, vuelo o vehiculo)
app.post('/api/reservar', auth, async (req, res, next) => {

    const queToken = req.headers.authorization.split(" ")[1];
    const queURL = `${URL_WS_transacciones}/reservar`;

    var res1 = {};
    var userID = {}; 

    userID = await Token.decodificaToken(queToken)
    .then(userID => {
        return userID;
    })

    const queEmail = `${URL_WS_users}/api/users/${userID}`
        res1 = await fetch(queEmail, {method: 'GET'}).then(res => res.json())
                //Mi lógica de negocio...
            .then(json => {
                res1 = Object.assign({}, json.Elementos);
                return res1;
            }).catch(function(err){
                console.error(err);
                return err;
            });
            //console.log(res1);
    // Pasamos la reserva
    const reserva = {
        email: res1.email,
        vuelo: req.body.vuelo,
        vehiculo: req.body.vehiculo,
        hotel: req.body.hotel
    }
    fetch(queURL, {
                    method: 'POST', 
                    body: JSON.stringify(reserva), 
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${queToken}`}
                }).then(res => res.json())
    .then(json => {
        res.status(200).json({
            result: json
        });
    })
    .catch(err => {
        res.status(400).json({
            result: err
        });
    })
})

// Cancelar reserva (hotel, vuelo o vehiculo)
app.delete('/api/reservar', auth, async (req, res, next) => {

    const queToken = req.headers.authorization.split(" ")[1];
    const queURL = `${URL_WS_transacciones}/reservar`;

    var res1 = {};
    var userID = {}; 

    userID = await Token.decodificaToken(queToken)
    .then(userID => {
        return userID;
    })

    const queEmail = `${URL_WS_users}/api/users/${userID}`
        res1 = await fetch(queEmail, {method: 'GET'}).then(res => res.json())
                //Mi lógica de negocio...
            .then(json => {
                res1 = Object.assign({}, json.Elementos);
                return res1;
            }).catch(function(err){
                console.error(err);
                return err;
            });
            //console.log(res1);
    // Pasamos la reserva
    const reserva = {
        email: res1.email,
        vuelo: req.body.vuelo,
        vehiculo: req.body.vehiculo,
        hotel: req.body.hotel
    }
    fetch(queURL, {
                    method: 'DELETE', 
                    body: JSON.stringify(reserva), 
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${queToken}`}
                }).then(res => res.json())
    .then(json => {
        res.status(200).json({
            result: json
        });
    })
    .catch(err => {
        res.status(400).json({
            result: err
        });
    })
})

https.createServer(opciones, app). listen(port, () => {
    console.log(`API RESTful GW ejecutándose en https://localhost:${port}/api/`);
});