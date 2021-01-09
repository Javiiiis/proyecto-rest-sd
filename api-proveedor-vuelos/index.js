'use strict'

const port = process.env.PORT || 3010;

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
const URL_DATABASE = "mongodb+srv://javi18pm:iMdX5mZcNnx1ojRA@sd-agencia.8nzbs.mongodb.net/Vuelos?retryWrites=true&w=majority";

var db = mongojs(URL_DATABASE); // Enlazando con la DB SD-Viajes, podría pasar la IP y el PUERTO.
var id = mongojs.ObjectID; // Función para convertir un id textual en un objeto mongojs.

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

app.get('/api', (req, res, next) => {
    // Invocamos a la base de datos para mostrar todas las colecciones presentes en la BD.
    db.getCollectionNames((err, vuelos) => {
        if (err) return next(err);
        console.log(vuelos);
        res.json({ 
            result: 'OK',
            Vuelos: vuelos
        });
    });
});

// Implementamos el API RESTFul a través de los métodos

// Obtenemos todos los elementos de la tabla :coleccion (Ofertas de Vuelos).
app.get('/api/:coleccion', (req, res, next) => {
    const queColeccion = req.params.coleccion;
    console.log('GET /api/:coleccion');

    db.collection(queColeccion).find({reservado: false} ,(err, elementos) => {
        if (err) return next(err); // Propagamos el error

        console.log(queColeccion);
        res.json({ 
            result: 'OK',
            Coleccion: queColeccion,
            Elementos: elementos
        });
    });
});

app.get('/api/:coleccion/search', (req, res, next) => {
    console.log('GET /api/:coleccion/search');
    const queColeccion = req.params.coleccion;
    const request = req.body;

    db.collection(queColeccion).find({fecha_ida: request.fecha_ida, 
                                      fecha_vuelta: request.fecha_vuelta, 
                                      origen: request.origen, 
                                      destino: request.destino,
                                      reservado: false
                                    }, (err, elementos) => {
        if (err) return next(err); // Propagamos el error
        console.log(queColeccion);
        res.json({ 
            result: 'OK',
            Coleccion: queColeccion,
            Elementos: elementos
        });
    });
});

// Obtener la coleccion (Oferta o Reserva) mediante un id dado.
app.get('/api/:coleccion/:id', (req, res, next) => {
    const queID = req.params.id;
    const queColeccion = req.params.coleccion;

    db.collection(queColeccion).findOne(id(queID), (err, elemento) => {
        if (err) return next(err); // Propagamos el error
        console.log(elemento);
        res.json({ 
            result: 'OK',
            reservas: queColeccion,
            Elementos: elemento
        });
    });
});

// Crear un nuevo elemento.
app.post('/api/:coleccion', auth, (req, res, next) => {
    const nuevoElemento = req.body;
    const coleccion = req.params.collection;
    
    if(!nuevoElemento.nombre) {
        res.status(400).json({
            error: 'Bad data',
            descripcion: 'Se precisa al menos un campo <nombre>'
        });
    } else {
        db.collection(coleccion).save(nuevoElemento, (err, elementoGuardado) => {
            if (err) return next(err);

            res.status(201).json({
                result: 'OK',
                Coleccion: coleccion,
                Elemento: elementoGuardado
            });
        });
    }
});

// Modificar campos de un elemento concreto de cada uno de las colecciones.
app.put('/api/:coleccion/:id', auth, (req, res, next) => {
    const queID = req.params.id;
    const queColeccion = req.params.coleccion;
    const elementoNuevo = req.body;

    db.collection(queColeccion).update(
        {_id: id(queID)},
        {$set: elementoNuevo}, {safe: true, multi:false}, (err, result) => {
            if (err) return next(err);

            console.log(result); // Ver que nos devuelve.
            res.json({
                result: 'OK',
                Coleccion: queColeccion,
                _id: queID,
                resultado: result
            });
        }
    );
});

// Eliminar un elemento de ofertas mediante su id.
app.delete('/api/ofertas/:id', auth, (req, res, next) => {
    const queID = req.params.id;
    const queOferta = req.params.ofertas;

    db.collection(queOferta).remove(
        {_id: id(queID)},
        (err, result) => {
            if (err) return next(err);

            console.log(result); // Ver que nos devuelve.
            res.json({
                result: 'OK',
                Coleccion: queOferta,
                _id: queID,
                resultado: result
            });
        }
    );
});

// Reservar
app.post('/api/reserva/vuelo/:id', auth, (req, res, next) => {
    const queID = req.params.id;
    const queUser = req.body.email;
    var reserva;

    db.collection("Ofertas").findOne(id(queID), (err, elemento) => {
        if(err) return next(err);
        if(elemento != null){
            if(elemento.reservado != true){
                reserva = {
                    "compañia": elemento.compañia,
                    "fecha_ida": elemento.fecha_ida,
                    "fecha_vuelta": elemento.fecha_vuelta,
                    "origen": elemento.origen,
                    "destino": elemento.destino,
                    "precio": elemento.precio,
                    "reservado": true,
                    "usuario": queUser
                }
                db.collection("Ofertas").update({_id: id(queID)}, {$set: reserva}, {safe: true, multi:false}, (err, result) => {
                    if (err) return next(err);
                    console.log(result); // Ver que nos devuelve.
                    res.json({
                        result: 'OK',
                        Coleccion: "Ofertas",
                        _id: queID,
                        resultado: result,
                        Elementos: reserva
                    });
                });
            }
            else {
                res.status(400).json({
                    error: 'El vuelo ya se encuentra reservado'
                });
            }
        }
        else {
            res.status(400).json({
                error: 'No existe el paquete'
            });
        }
    });
});

// Cancelar reserva
app.delete('/api/reserva/vuelo/:id', auth, (req, res, next) => {
    const queID = req.params.id;
    const queUser = req.body.email;

    var reserva;

    db.collection("Ofertas").findOne(id(queID), (err, elemento) => {
        if(err) return next(err);
        if(elemento != null){
            if(elemento.reservado == true){
                reserva = {
                    "compañia": elemento.compañia,
                    "fecha_ida": elemento.fecha_ida,
                    "fecha_vuelta": elemento.fecha_vuelta,
                    "origen": elemento.origen,
                    "destino": elemento.destino,
                    "precio": elemento.precio,
                    "reservado": false
                }
                console.log(elemento.usuario);
                console.log(req.body.usuario);
                if(elemento.usuario == queUser){
                    db.collection("Ofertas").update({_id: id(queID)}, {$set: reserva, $unset: {"usuario": ""}}, {safe: true, multi:false}, (err, result) => {
                        if (err) return next(err);
                        console.log(result); // Ver que nos devuelve
                        res.json({
                            result: 'OK',
                            Coleccion: "Ofertas",
                            _id: queID,
                            resultado: result,
                            Elementos: reserva
                        });
                    });
                }
                else {
                    res.status(400).json({
                        error: 'No se puede cancelar la reserva del vuelo',
                        descripcion: 'usuario incorrecto'
                    });
                }
            }
            else {
                res.status(400).json({
                    error: 'Reserva no encontrada'
                });
            }
        }
        else {
            res.status(400).json({
                error: 'No existe el paquete'
            });
        }
    });
});

https.createServer(opciones, app). listen(port, () => {
    console.log(`WS API RESTful Proveedor de Vuelos ejecutándose en https://localhost:${port}/api/:coleccion`);
});

// app.listen(port, () => {
//     console.log(`API RESTful CRUD ejecutándose en http://localhost:${port}/api/{reservas}/{id}`);
// });