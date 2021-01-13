'use strict'

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const port = process.env.PORT || 3100;

const express = require('express');
const logger = require('morgan');
const fetch = require('node-fetch');
const fs = require('fs');
const https = require('https');
const { json } = require('express');
const Token = require('./services/token.service');
const doc = require('./documentacion.json');
const { connect } = require('http2');

const opciones = {
    key: fs.readFileSync('./cert/key.pem'),
    cert: fs.readFileSync('./cert/cert.pem')
};

const URL_WS_vuelos = "https://localhost:3010/api";
const URL_WS_vehiculos = "https://localhost:3011/api";
const URL_WS_hoteles = "https://localhost:3012/api";
const URL_WS_Pagos = "https://172.20.42.18:3005/api";


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
function chooseURL(service){
    var url;
    switch(service){
        case "vuelo":
            url = `${URL_WS_vuelos}/Ofertas`;
            break;
        case "vehiculo":
            url = `${URL_WS_vehiculos}/Ofertas`;
            break;
        case "hotel":
            url = `${URL_WS_hoteles}/Ofertas`;
        default:
            break;
    }
    return url;
}

// Implementamos el API RESTFul a través de los métodos

app.get('/api/:servicio/Ofertas', (req, res, next) => {
    const queServicio = req.params.servicio;
    const queURL = `${chooseURL(queServicio)}`;

    //Cliente de mi WS (web service).
    fetch(queURL)
        .then(res => res.json())
        .then(json => {
        //Mi lógica de negocio...
        res.json({
            result: 'OK',
            Servicio: queServicio,
            Elementos: json.Elementos
        });
    });
});

// Reservar
app.post('/api/reservar', auth, async (req, res, next) => {
    const user = req.body.email; 
    const vuelo = req.body.vuelo; //id del vuelo
    const vehiculo = req.body.vehiculo; //id del vehiculo
    const hotel = req.body.hotel;//id del hotel
    const queToken = req.headers.authorization.split(" ")[1];

    // Variables para controlar los mensajes de cada proveedor
    var res1 = {}; var compR1 = {};
    var res2 = {}; var compR2 = {};
    var res3 = {}; var compR3 = {};
    var res4 = {};
    var estado = "OK";
    var message;
    // Mensajes de compensación
    var compensatory_1 = "Nada que compensar";
    var compensatory_2 = "Nada que compensar";
    var compensatory_3 = "Nada que compensar";
    var conectionFailed = false; //controlar si algun proveedor ha caido
    var bookError = false; //controlar si alguna reserva ha fallado

    if(user == null){ //si el usuario no existe, abortar.
        res.status(403).json({
            result: 'KO',
            message: "Usuario no encontrado",
        });
    }
    else {
        // Cuando vuelo, hotel y vehiculo sean null, significa que no queremos reservar de ese proveedor.
        if(vuelo != null){
            const getURL = `${URL_WS_vuelos}/reserva/vuelo/${vuelo}`;
            res1 = await fetch(getURL, {method: 'POST', body: JSON.stringify(req.body), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                //Mi lógica de negocio...
            .then(json => {
                res1 = Object.assign({}, json.Elementos);
                return res1;
            }).catch(function(err){
                console.error(err);
                conectionFailed = true;
                return err;
            });
            if(Object.keys(res1).length === 0) {
                message = "Error al reservar el vuelo, transacción abortada.";
                estado = "Abortada";
                bookError = true;
            }
            else {
                if(!conectionFailed) res1 = "Reserva realizada correctamente";
            }
            if(conectionFailed) {
                message = "Fallo al intentar conectarse con el proveedor de vuelos, transacción abortada.";
                estado = "Abortada";
            }
        }   
        if(vehiculo != null && !bookError && !conectionFailed){ //realizar reserva si no hay problemas de conexión ni de reservas fallidas.
            const getURLvehi = `${URL_WS_vehiculos}/reserva/vehiculo/${vehiculo}`;
            res2 = await fetch(getURLvehi, {method: 'POST', body: JSON.stringify(req.body), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                //Mi lógica de negocio...
            .then(json => {
                res2 = Object.assign({}, json.Elementos);
                return res2;
            }).catch(function(err){
                console.error(err);
                conectionFailed = true;
                return err;
            });
            if(Object.keys(res2).length === 0) {
                message = "Error al reservar el vehiculo, transacción abortada.";
                estado = "Abortada";
                bookError = true;
            }
            else {
                if(!conectionFailed) res2 = "Reserva realizada correctamente";
            }
            if(conectionFailed) {
                message = "Fallo al intentar conectarse con el proveedor de vehiculos, transacción abortada.";
                estado = "Abortada";
            }
            if(vuelo != null && (bookError || conectionFailed)){ // si ya tenemos el vuelo reservado y aparece algun error ya sea de reserva o de conexión...
                const getURLvuelo = `${URL_WS_vuelos}/reserva/vuelo/${vuelo}`;
                compR1 = await fetch(getURLvuelo, {method: 'DELETE', body: JSON.stringify(req.body), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                .then(json => {
                    compR1 = Object.assign({}, json.Elementos);
                    return compR1;
                }) // Anulamos la reserva
                compensatory_1 = "La reserva del vuelo ha sido anulada";
                estado = "Abortada";
                res1 = {};
            }
        }
        if(hotel != null && !conectionFailed && !bookError){ //realizar reserva si no hay problemas de conexión ni de reservas fallidas.
            const getURLhot = `${URL_WS_hoteles}/reserva/hotel/${hotel}`;
            res3 = await fetch(getURLhot, {method: 'POST', body: JSON.stringify(req.body), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                //Mi lógica de negocio...
            .then(json => {
                res3 = Object.assign({}, json.Elementos);
                return res3;
            }).catch(function(err){
                console.error(err);
                conectionFailed = true;
                return err;
            });
            if(Object.keys(res3).length === 0) {
                message = "Error al reservar el hotel, transacción abortada.";
                estado = "Abortada";
                bookError = true;
            }
            else {
                if(!conectionFailed) res3 = "Reserva realizada correctamente";
            }
            if(conectionFailed) {
                message = "Fallo al intentar conectarse con el proveedor de hoteles, transacción abortada.";
                estado = "Abortada";
            }
            if(vuelo != null && (bookError || conectionFailed)){ // si ya tenemos el vuelo reservado y aparece algun error ya sea de reserva o de conexión...
                const getURLvuelo = `${URL_WS_vuelos}/reserva/vuelo/${vuelo}`;
                compR1 = await fetch(getURLvuelo, {method: 'DELETE', body: JSON.stringify(req.body), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                .then(json => {
                    compR1 = Object.assign({}, json.Elementos);
                    return compR1;
                }) // Anulamos la reserva
                compensatory_1 = "La reserva del vuelo ha sido anulada";
                estado = "Abortada";
                res1 = {};
            }
            if(vehiculo != null && (bookError || conectionFailed)){ // si ya tenemos el vehiculo reservado y aparece algun error ya sea de reserva o de conexión...
                const getURLvehi = `${URL_WS_vehiculos}/reserva/vehiculo/${vehiculo}`;
                compR2 = await fetch(getURLvehi, {method: 'DELETE', body: JSON.stringify(req.body), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                .then(json => {
                    compR2 = Object.assign({}, json.Elementos);
                    return compR2;
                }) // Anulamos la reserva
                compensatory_2 = "La reserva del vehiculo ha sido anulada";
                estado = "Abortada";
                res2 = {};
            }
        }

        if((vuelo != null || vehiculo != null || hotel != null) && !conectionFailed && !bookError){ // Si hay alguna reserva realizado y no ha fallado ni la conexión ni una reserva...
            const URLpagos = `${URL_WS_Pagos}/payment`;
            res4 = await fetch(URLpagos, {method: 'GET', headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
            .then(json => {
                res4 = Object.assign({}, json);
                return res4;
            }).catch(function(err){
                console.error(err);
                conectionFailed = true;
                return err;
            });
            if(res4.pago == false) { // Si el pago no se ha realizado ...
                message = "Pago rechazado, se ha abortado la conexión";
                estado = "Abortada";
                bookError = true;
            }
            if(conectionFailed) { // Si la conexión a la pasarela ha fallado ...
                message = "Fallo al intentar conectarse con la pasarela de pago, transacción abortada";
                estado = "Abortada";
            }
            if(vuelo != null && (bookError || conectionFailed)){ // si ya tenemos el vuelo reservado y aparece algun error ya sea de reserva o de conexión...
                const getURLvuelo = `${URL_WS_vuelos}/reserva/vuelo/${vuelo}`;
                compR1 = await fetch(getURLvuelo, {method: 'DELETE', body: JSON.stringify(req.body), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                .then(json => {
                    compR1 = Object.assign({}, json.Elementos);
                    return compR1;
                }) // Anulamos la reserva
                compensatory_1 = "La reserva del vuelo ha sido anulada";
                res1 = {};
            }
            if(vehiculo != null && (bookError || conectionFailed)){ // si ya tenemos el vehiculo reservado y aparece algun error ya sea de reserva o de conexión...
                const getURLvehi = `${URL_WS_vehiculos}/reserva/vehiculo/${vehiculo}`;
                compR2 = await fetch(getURLvehi, {method: 'DELETE', body: JSON.stringify(req.body), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                .then(json => {
                    compR2 = Object.assign({}, json.Elementos);
                    return compR2;
                }) // Anulamos la reserva
                compensatory_2 = "La reserva del vehiculo ha sido anulada";
                res2 = {};
            }
            if(hotel != null && (bookError || conectionFailed)){ // si ya tenemos el hotel reservado y aparece algun error ya sea de reserva o de conexión...
                const getURLhot = `${URL_WS_hoteles}/reserva/hotel/${hotel}`;
                compR3 = await fetch(getURLhot, {method: 'DELETE', body: JSON.stringify(req.body), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                .then(json => {
                    compR3 = Object.assign({}, json.Elementos);
                    return compR3;
                }) // Anulamos la reserva
                compensatory_3 = "La reserva del hotel ha sido anulada";
                res3 = {};
            }
        }

        if(Object.keys(res1).length === 0 && Object.keys(res2).length === 0 && Object.keys(res3).length === 0){
            estado = "Abortada";
        }

        res.status(200).json({
            estadoTransaccion: estado,
            reservaVuelo: res1,
            reservaVehiculo: res2,
            reservaHotel: res3,
            Entidad_Bancaria: res4,
            'Error_de_conexion?': conectionFailed,
            'Error_al_reservar?': bookError,
            Mensaje: message,
            'Compensacion_de_vuelo?': compensatory_1,
            'Compensacion_de_vehiculo?': compensatory_2,
            'Compensacion_de_hotel?': compensatory_3
        })
    }
});

// Cancelar reserva
app.delete('/api/reservar', auth, async (req, res, next) => {
    const user = req.body.email; 
    const vuelo = req.body.vuelo; //id del vuelo
    const vehiculo = req.body.vehiculo; //id del vehiculo
    const hotel = req.body.hotel;//id del hotel
    const queToken = req.headers.authorization.split(" ")[1];

    // Variables para controlar los mensajes de cada proveedor
    var res1 = {}; var compR1 = {};
    var res2 = {}; var compR2 = {};
    var res3 = {}; var compR3 = {};
    var res4 = {};
    var estado = "OK";
    var message;
    // Mensajes de compensación
    var compensatory_1 = "Nada que compensar";
    var compensatory_2 = "Nada que compensar";
    var compensatory_3 = "Nada que compensar";
    var conectionFailed = false; //controlar si algun proveedor ha caido
    var bookError = false; //controlar si alguna reserva ha fallado

    const cliente = {
        email: req.body.email
    }

    if(user == null){ //si el usuario no existe, abortar.
        res.status(403).json({
            result: 'KO',
            message: "Usuario no encontrado",
        });
    }
    else {
        // Cuando vuelo, hotel y vehiculo sean null, significa que no queremos cancelar la reserva de ese tipo.
        if(vuelo != null){
            const getURL = `${URL_WS_vuelos}/reserva/vuelo/${vuelo}`;
            res1 = await fetch(getURL, {method: 'DELETE', body: JSON.stringify(cliente), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                //Mi lógica de negocio...
            .then(json => {
                res1 = Object.assign({}, json.Elementos);
                return res1;
            }).catch(function(err){
                console.error(err);
                conectionFailed = true;
                return err;
            });
            if(Object.keys(res1).length === 0) {
                message = "Error al intentar anular la reserva del vuelo, transacción abortada.";
                estado = "Abortada";
                bookError = true;
            }
            else {
                if(!conectionFailed) {
                    res1 = "Reserva cancelada correctamente";
                }
            }
            if(conectionFailed) {
                message = "Fallo al intentar conectarse con el proveedor de vuelos, transacción abortada.";
                estado = "Abortada";
            }
        }   
        if(vehiculo != null && !bookError && !conectionFailed){ //realizar reserva si no hay problemas de conexión ni de reservas fallidas.
            const getURLvehi = `${URL_WS_vehiculos}/reserva/vehiculo/${vehiculo}`;
            res2 = await fetch(getURLvehi, {method: 'DELETE', body: JSON.stringify(cliente), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                //Mi lógica de negocio...
            .then(json => {
                res2 = Object.assign({}, json.Elementos);
                return res2;
            }).catch(function(err){
                console.error(err);
                conectionFailed = true;
                return err;
            });
            if(Object.keys(res2).length === 0) {
                message = "Error al intentar anular la reserva del vehiculo, transacción abortada.";
                estado = "Abortada";
                bookError = true;
            }
            else {
                if(!conectionFailed) res2 = "Reserva cancelada correctamente";
            }
            if(conectionFailed) {
                message = "Fallo al intentar conectarse con el proveedor de vehiculos, transacción abortada.";
                estado = "Abortada";
            }
            if(vuelo != null && (bookError || conectionFailed)){ // si ya tenemos el vuelo reservado y aparece algun error ya sea de reserva o de conexión...
                const getURLvuelo = `${URL_WS_vuelos}/reserva/vuelo/${vuelo}`;
                compR1 = await fetch(getURLvuelo, {method: 'POST', body: JSON.stringify(req.body), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                .then(json => {
                    compR1 = Object.assign({}, json.Elementos);
                    return compR1;
                }) // Anulamos la reserva
                compensatory_1 = "La reserva del vuelo no ha podido ser anulada";
                estado = "Abortada";
                res1 = {};
            }
        }
        if(hotel != null && !conectionFailed && !bookError){ //realizar reserva si no hay problemas de conexión ni de reservas fallidas.
            const getURLhot = `${URL_WS_hoteles}/reserva/hotel/${hotel}`;
            res3 = await fetch(getURLhot, {method: 'DELETE', body: JSON.stringify(cliente), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                //Mi lógica de negocio...
            .then(json => {
                res3 = Object.assign({}, json.Elementos);
                return res3;
            }).catch(function(err){
                console.error(err);
                conectionFailed = true;
                return err;
            });
            if(Object.keys(res3).length === 0) {
                message = "Error al intentar anular la reserva del hotel, transacción abortada.";
                estado = "Abortada";
                bookError = true;
            }
            else {
               if(!conectionFailed) res3 = "Reserva cancelada correctamente";
            }
            if(conectionFailed) {
                message = "Fallo al intentar conectarse con el proveedor de hoteles, transacción abortada.";
                estado = "Abortada";
            }
            if(vuelo != null && (bookError || conectionFailed)){ // si ya tenemos el vuelo reservado y aparece algun error ya sea de reserva o de conexión...
                const getURLvuelo = `${URL_WS_vuelos}/reserva/vuelo/${vuelo}`;
                compR1 = await fetch(getURLvuelo, {method: 'POST', body: JSON.stringify(req.body), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                .then(json => {
                    compR1 = Object.assign({}, json.Elementos);
                    return compR1;
                }) // Anulamos la reserva
                compensatory_1 = "La reserva del vuelo no ha podido ser anulada";
                estado = "Abortada";
                res1 = {};
            }
            if(vehiculo != null && (bookError || conectionFailed)){ // si ya tenemos el vehiculo reservado y aparece algun error ya sea de reserva o de conexión...
                const getURLvehi = `${URL_WS_vehiculos}/reserva/vehiculo/${vehiculo}`;
                compR2 = await fetch(getURLvehi, {method: 'POST', body: JSON.stringify(req.body), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                .then(json => {
                    compR2 = Object.assign({}, json.Elementos);
                    return compR2;
                }) // Anulamos la reserva
                compensatory_2 = "La reserva del vehiculo no ha podido ser anulada";
                estado = "Abortada";
                res2 = {};
            }
        }

        if((vuelo != null || vehiculo != null || hotel != null) && !conectionFailed && !bookError){ // Si hay alguna reserva realizado y no ha fallado ni la conexión ni una reserva...
            const URLpagos = `${URL_WS_Pagos}/payment`;
            res4 = await fetch(URLpagos, {method: 'GET', headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
            .then(json => {
                res4 = Object.assign({}, json);
                return res4;
            }).catch(function(err){
                console.error(err);
                conectionFailed = true;
                return err;
            });
            if(res4.pago == false) { // Si el pago no se ha realizado ...
                message = "Error al intentar devolver el pago";
                estado = "Abortada";
                bookError = true;
            }
            else {
                res4 = "Devolución del pago realizado correctamente"
            }
            if(conectionFailed) { // Si la conexión a la pasarela ha fallado ...
                message = "Fallo al intentar conectarse con la pasarela de pago, transacción abortada";
                estado = "Abortada";
            }
            if(vuelo != null && (bookError || conectionFailed)){ // si ya tenemos el vuelo reservado y aparece algun error ya sea de reserva o de conexión...
                const getURLvuelo = `${URL_WS_vuelos}/reserva/vuelo/${vuelo}`;
                compR1 = await fetch(getURLvuelo, {method: 'POST', body: JSON.stringify(req.body), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                .then(json => {
                    compR1 = Object.assign({}, json.Elementos);
                    return compR1;
                }) // Anulamos la reserva
                compensatory_1 = "La reserva del vuelo no ha podido ser anulada";
                res1 = {};
            }
            if(vehiculo != null && (bookError || conectionFailed)){ // si ya tenemos el vehiculo reservado y aparece algun error ya sea de reserva o de conexión...
                const getURLvehi = `${URL_WS_vehiculos}/reserva/vehiculo/${vehiculo}`;
                compR2 = await fetch(getURLvehi, {method: 'POST', body: JSON.stringify(req.body), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                .then(json => {
                    compR2 = Object.assign({}, json.Elementos);
                    return compR2;
                }) // Anulamos la reserva
                compensatory_2 = "La reserva del vehiculo no ha podido ser anulada";
                res2 = {};
            }
            if(hotel != null && (bookError || conectionFailed)){ // si ya tenemos el hotel reservado y aparece algun error ya sea de reserva o de conexión...
                const getURLhot = `${URL_WS_hoteles}/reserva/hotel/${hotel}`;
                compR3 = await fetch(getURLhot, {method: 'POST', body: JSON.stringify(req.body), headers: {'Content-Type': 'application/json','Authorization': `Bearer ${queToken}`}}).then(res => res.json())
                .then(json => {
                    compR3 = Object.assign({}, json.Elementos);
                    return compR3;
                }) // Anulamos la reserva
                compensatory_3 = "La reserva del hotel no ha podido ser anulada";
                res3 = {};
            }
        }

        if(Object.keys(res1).length === 0 && Object.keys(res2).length === 0 && Object.keys(res3).length === 0){
            estado = "Abortada";
        }

        res.status(200).json({
            estadoTransaccion: estado,
            reservaVuelo: res1,
            reservaVehiculo: res2,
            reservaHotel: res3,
            Entidad_Bancaria: res4,
            'Error_de_conexion?': conectionFailed,
            'Error_al_reservar?': bookError,
            Mensaje: message,
            'Compensacion_de_vuelo?': compensatory_1,
            'Compensacion_de_vehiculo?': compensatory_2,
            'Compensacion_de_hotel?': compensatory_3
        })
    }
});



https.createServer(opciones, app). listen(port, () => {
    console.log(`API Transacciones ejecutándose en https://localhost:${port}/api/`);
});

// app.listen(port, () => {
//     console.log(`API GW RESTful CRUD ejecutándose en http://localhost:${port}/api/{coleccion}/{id}`);
// })