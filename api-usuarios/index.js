'use strict'

const port = process.env.PORT || 3002;

const https = require('https');
const express = require('express');
const logger = require('morgan');
const mongojs = require('mongojs');
const fs = require('fs');
const helmet = require('helmet');
const moment = require('moment');

const Password = require('./services/pass.service');
const Token = require('./services/token.service');

const opciones = {
    key: fs.readFileSync('./cert/key.pem'),
    cert: fs.readFileSync('./cert/cert.pem')
};

const app = express();
const URL_DATABASE = "mongodb+srv://javi18pm:iMdX5mZcNnx1ojRA@sd-agencia.8nzbs.mongodb.net/Usuarios?retryWrites=true&w=majority";

var db = mongojs(URL_DATABASE); // Enlazando con la DB SD-Viajes, podría pasar la IP y el PUERTO.
var id = mongojs.ObjectID; // Función para convertir un id textual en un objeto mongojs.

// Declaramos los middleware
app.use(logger('dev'));
app.use(express.urlencoded({extended: false}));
app.use(express.json());
app.use(helmet());

// Rutas y Controladores.
// Implementamos el API RESTFul a través de los métodos

app.get('/api/users', (req, res, next) => {
    
    db.collection('users').find((err, elemento) => {
        if (err) return next(err); // Propagamos el error
        console.log(elemento);
        res.json({ 
            result: 'OK',
            reservas: 'users',
            Elementos: elemento
        });
    });
});

app.get('/api/users/:id', (req, res, next) => {
    const queID = req.params.id;
    db.collection('users').findOne(id(queID), (err, elemento) => {
        if (err) return next(err); // Propagamos el error
        console.log(elemento);
        res.json({ 
            result: 'OK',
            reservas: 'users',
            Elementos: elemento
        });
    });
});

// Registro
app.post('/signup', (req, res, next) => {
    const nuevoElemento = req.body;
    const user = {
        usuario: nuevoElemento.usuario,
        email: nuevoElemento.email,
        password: nuevoElemento.password,
        signUpDate: moment().unix(),
        lastLoginDate: moment().unix()
    }
    if(!nuevoElemento.email) {
        res.status(400).json({
            error: 'Bad data',
            descripcion: 'Se precisa introducir un email'
        });
    }
    else {
        // Comprobar usuario con mismo email
        db.collection("users").findOne({email: user.email}, (err, userCreated) => {
            if(err) return next(err);
            if(!userCreated){
                Password.encriptaPassword(user.password)
                .then(hash => {
                    user.password = hash;
                    db.collection("users").save(user, (err, elementoGuardado) => {
                        if(err) return next(err);
                        console.log(elementoGuardado);
                        res.status(201).json({
                            result: 'OK',
                            Coleccion: "users",
                            Elemento: elementoGuardado
                        });
                    });
                });
            } 
            else {
                res.status(400).json({
                    result:'Error',
                    mensaje:'El email ya existe'
                });
            }
        });
    }
});

// Login
app.post('/login', (req, res, next) => {
    const ident = req.body;
    db.collection("users").findOne({email:ident.email}, (err, user) => {
        if(user){
            Password.comparaPassword(ident.password, user.password)
            .then(comparar => {
                if(comparar){
                    const token = Token.creaToken(user); // creamos un token
                    const temp = {
                        lastLoginDate: moment(Date.now()).format('LLLL'),
                    }
                    db.collection("users").update({_id: id(user._id)}, {$set: temp}, {safe: true, multi: false}, (err, result) => {
                        if(err) return next(err); // Propagamos el error
                        console.log(result);
                        res.status(201).json({
                            result:'OK',
                            message: 'Login realizado con éxito',
                            token: token
                        });
                    });
                }
                else {
                    res.status(400).json({
                        result: 'Error',
                        message: 'Contraseña incorrecta'
                    });
                }
            });
        }
        else {
            res.status(400).json({
                result: 'Error',
                message: 'El usuario no existe'
            });
        }
    });
});

https.createServer(opciones, app). listen(port, () => {
    console.log(`API RESTful Usuarios ejecutándose en https://localhost:${port}/api/users`);
});

// app.listen(port, () => {
//     console.log(`API RESTful CRUD ejecutándose en http://localhost:${port}/api/{reservas}/{id}`);
// });