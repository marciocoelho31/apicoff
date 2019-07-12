require('dotenv-safe').config({
  allowEmptyValues: true
});
var jwt = require('jsonwebtoken');

var http = require('http');
const express = require('express')
const app = express()
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const helmet = require('helmet');
var bodyParser = require('body-parser')

const mysql = require('mysql');

app.use(logger('dev'));
app.use(helmet());
//app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({ extended: true, defaultCharset: 'iso-8859-1' }));
app.use(bodyParser.json());
app.use(cookieParser());

app.get('/', (req, res, next) => {
  console.log('...');
})

app.post('/login', (req, res, next) => {

    if (req.body.pwd === process.env.COFF_SECRET){
        const id = 1; //esse id viria do banco de dados
        var token = jwt.sign({ id }, process.env.SECRET, {
        expiresIn: 300 // expires in 5min
        });
        res.status(200).send({ auth: true, token: token });
    }
    else {
      res.status(500).send('Login inválido!');
    }
})

function verifyJWT(req, res, next){
  var token = req.headers['x-access-token'];
  if (!token) 
    return res.status(401).send({ auth: false, message: 'No token provided.' });
  else {
      jwt.verify(token, process.env.SECRET, function(err, decoded) {
        if (err) 
        return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
        
        // se tudo estiver ok, salva no request para uso posterior
        req.userId = decoded.id;
        next();
      });
    }
  }

  
function execSQLQuery(sqlQry, res){
  const connection = mysql.createConnection({
    host     : process.env.BDHOST,
    port     : process.env.BDPORT,
    user     : process.env.BDUSER,
    password : process.env.BDPWD,
    database : process.env.BDNAME
  });

  connection.query(sqlQry, function(error, results, fields){
      if(error) 
        res.json(error);
      else
        res.json(results);
      connection.end();
  });
}

app.get('/atendimento', verifyJWT, (req, res, next) => {

  let cliente = req.headers['sel-atend-cli'];
  let data1 = req.headers['sel-atend-dt1'] || '';
  let data2 = req.headers['sel-atend-dt2'] || '';
  let opitem = req.headers['sel-atend-opitem'];

  if (data1 == '' && data2 != '') {
    ddata1 = new Date();
    data1 = ddata1.getFullYear() + "-" + parseInt(ddata1.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata1.getDate().toString().padStart(2, "0");
  }
  else if (data2 == '' && data1 != '') {
    ddata2 = new Date();
    data2 = ddata2.getFullYear() + "-" + parseInt(ddata2.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata2.getDate().toString().padStart(2, "0");
  }

  let pesquisa = "SELECT * FROM pendencias where not isnull(cliente)";
  if (cliente != "") {
    pesquisa += " and cliente='" + cliente + "'";
  }
  if (opitem == "1") {
    if (data1 != '' && data2 != '') {
      pesquisa += " and not isnull(datapos) and datapos>='" + data1.substr(0, 10) + "' and datapos<='" + data2.substr(0, 10) + "'";
    }
    pesquisa += " and posicao='DISPONÍVEL'";
    pesquisa += " order by datapos desc";
  }
  else if (opitem == "2") {
    pesquisa += " and not isnull(prior) and prior>0 and posicao<>'DISPONÍVEL'";
    pesquisa += " order by prior";
  }
  else if (opitem == "3") {
    pesquisa += " and not isnull(prior) and prior>0 and posicao='EM ANÁLISE'";
    if (data1 != '' && data2 != '') {
      pesquisa += " and not isnull(datasolic) and datasolic>='" + data1.substr(0, 10) + "' and datasolic<='" + data2.substr(0, 10) + "'";
    }
    pesquisa += " order by prior";
  }
  else if (opitem == "4") {
    pesquisa += " and not isnull(prior) and prior>0 and posicao='EM PRODUÇÃO'";
    if (data1 != '' && data2 != '') {
      pesquisa += " and not isnull(datasolic) and datasolic>='" + data1.substr(0, 10) + "' and datasolic<='" + data2.substr(0, 10) + "'";
    }
    pesquisa += " order by prior";
  }
  else {
    if (data1 != '' && data2 != '') {
      pesquisa += " and not isnull(datapos) and datapos>='" + data1.substr(0, 10) + "' and datapos<='" + data2.substr(0, 10) + "'";
    }
    pesquisa += " order by datapos desc";
  }

  execSQLQuery(pesquisa, res);
})

app.get('/atendimento/maxprior', verifyJWT, (req, res, next) => {
  let pesquisa = "SELECT max(prior) as prior FROM pendencias";
  execSQLQuery(pesquisa, res);
})

app.get('/clientes', verifyJWT, (req, res, next) => {
  let sistema = req.headers['sel-cli-sist'];
  let cidade = req.headers['sel-cli-cid'];
  let estado = req.headers['sel-cli-est'];
  let opaut = req.headers['sel-cli-aut'];
  let opcobr = req.headers['sel-cli-cobr'];

  let pesquisa = "SELECT nome FROM clientes where not isnull(nome)";
  if (sistema != "") {
    pesquisa += " and sistema='" + sistema + "'";
  }
  if (cidade != "") {
    pesquisa += " and cidade='" + cidade + "'";
  }
  if (estado != "") {
    pesquisa += " and estado='" + estado + "'";
  }
  if (opaut == "1") {
    pesquisa += " and not isnull(autorizado) and autorizado='SIM'"
  }
  else if (opaut == "2") {
    pesquisa += " and not isnull(autorizado) and autorizado='NÃO'"
  }
  if (opcobr == "1") {
    pesquisa += " and not isnull(cobranca) and cobranca='S'"
  }
  else if (opcobr == "2") {
    pesquisa += " and not isnull(cobranca) and cobranca='N'"
  }
  pesquisa += " order by nome";

  execSQLQuery(pesquisa, res);
})

app.get('/clientes/telefone', verifyJWT, (req, res, next) => {
  let cliente = req.headers['x-cli-pesq'];
  let pesquisa = "SELECT telefone FROM clientes where not isnull(nome) and nome='" + cliente + "'";
  execSQLQuery(pesquisa, res);
})

app.get('/clientesnome', verifyJWT, (req, res, next) => {
  execSQLQuery("SELECT nome FROM clientes order by nome", res);
})

app.get('/clientes/sistemas', verifyJWT, (req, res, next) => {
  execSQLQuery("SELECT distinct sistema FROM clientes order by sistema", res);
})

app.get('/clientes/cidades', verifyJWT, (req, res, next) => {
  execSQLQuery("SELECT distinct cidade FROM clientes order by cidade", res);
})

app.get('/clientes/estados', verifyJWT, (req, res, next) => {
  execSQLQuery("SELECT distinct estado FROM clientes order by estado", res);
})

app.get('/ligacoes', verifyJWT, (req, res, next) => {
  let cliente = req.headers['sel-lig-cli'];
  let data1 = req.headers['sel-lig-dt1'] || '';
  let data2 = req.headers['sel-lig-dt2'] || '';

  if (data1 == '' && data2 != '') {
    ddata1 = new Date();
    data1 = ddata1.getFullYear() + "-" + parseInt(ddata1.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata1.getDate().toString().padStart(2, "0");
  }
  else if (data2 == '' && data1 != '') {
    ddata2 = new Date();
    data2 = ddata2.getFullYear() + "-" + parseInt(ddata2.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata2.getDate().toString().padStart(2, "0");
  }
  else if (data1 == '' && data2 == '') {
    ddata1 = new Date();
    data1 = ddata1.getFullYear() + "-" + parseInt(ddata1.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata1.getDate().toString().padStart(2, "0");
    ddata2 = new Date();
    data2 = ddata2.getFullYear() + "-" + parseInt(ddata2.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata2.getDate().toString().padStart(2, "0");
  }

  let pesquisa = "SELECT * FROM rcp where not isnull(local)";
  if (cliente != "") {
    pesquisa += " and local='" + cliente + "'";
  }
  if (data1 != '' && data2 != '') {
    pesquisa += " and not isnull(data) and data>='" + data1.substr(0, 10) + "' and data<='" + data2.substr(0, 10) + "'";
  }
  pesquisa += " order by data desc, hora desc";

  execSQLQuery(pesquisa, res);
})

app.get('/visitas', verifyJWT, (req, res, next) => {
  let cliente = req.headers['sel-vis-cli'];
  let data1 = req.headers['sel-vis-dt1'] || '';
  let data2 = req.headers['sel-vis-dt2'] || '';

  if (data1 == '' && data2 != '') {
    ddata1 = new Date();
    data1 = ddata1.getFullYear() + "-" + parseInt(ddata1.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata1.getDate().toString().padStart(2, "0");
  }
  else if (data2 == '' && data1 != '') {
    ddata2 = new Date();
    data2 = ddata2.getFullYear() + "-" + parseInt(ddata2.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata2.getDate().toString().padStart(2, "0");
  }
  else if (data1 == '' && data2 == '') {
    ddata1 = new Date();
    data1 = ddata1.getFullYear() + "-" + parseInt(ddata1.getMonth() + 1).toString().padStart(2, "0") + "-" + (ddata1.getDate() - 5).toString().padStart(2, "0");
    ddata2 = new Date();
    data2 = ddata2.getFullYear() + "-" + parseInt(ddata2.getMonth() + 1).toString().padStart(2, "0") + "-" + (ddata2.getDate() + 15).toString().padStart(2, "0");
  }

  let pesquisa = "SELECT * FROM agenda where not isnull(local)";
  if (cliente != "") {
    pesquisa += " and local='" + cliente + "'";
  }
  if (data1 != '' && data2 != '') {
    pesquisa += " and not isnull(data) and data>='" + data1.substr(0, 10) + "' and data<='" + data2.substr(0, 10) + "'";
  }
  pesquisa += " order by data desc";

  execSQLQuery(pesquisa, res);
})

app.get('/atendimento/novo', verifyJWT, (req, res, next) => {
  let cliente = req.headers['dados-atend-cli'];
  let prior = req.headers['dados-atend-prior'];
  let tipo = req.headers['dados-atend-tipo'];
  let descricao = req.headers['dados-atend-descricao'];
  let solic = req.headers['dados-atend-solic'];
  let posicao = req.headers['dados-atend-posicao'];
  let sistema = '';
  let ddata1 = new Date();
  let data1 = ddata1.getFullYear() + "-" + parseInt(ddata1.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata1.getDate().toString().padStart(2, "0");
  let hora1 = ddata1.getHours().toString().padStart(2, "0") + ":" + ddata1.getMinutes().toString().padStart(2, "0");

  let tipoD = '';
  if (tipo == 0) {
    tipoD = 'ERRO';
  }
  else if (tipo == 1) {
    tipoD = 'AJUSTE';
  }
  else if (tipo == 2) {
    tipoD = 'SUGESTÃO';
  }
  let posicaoD = '';
  if (posicao == 0) {
    posicaoD = 'EM DESENVOLVIMENTO';
  }
  else if (posicao == 1) {
    posicaoD = 'EM ANÁLISE';
  }
  else if (posicao == 2) {
    posicaoD = 'EM PRODUÇÃO';
  }
  else if (posicao == 3) {
    posicaoD = 'DISPONÍVEL';
  }

  const connection = mysql.createConnection({
    host     : process.env.BDHOST,
    port     : process.env.BDPORT,
    user     : process.env.BDUSER,
    password : process.env.BDPWD,
    database : process.env.BDNAME
  });

  connection.query("select sistema from clientes where nome='" + cliente + "'", function(error, results, fields){
      for (let i in results) {
        sistema = results[i]['sistema'];
        break;
      }
        let comando = "insert into pendencias (cliente, prior, NovoItem, Urgente, tipo, descricao, datasolic, posicao, datapos, " + 
        "horapos, quemsolic, formasolic, usuario, sistema, dtlanc, descricaoorig) values ('" + cliente + "', " + prior + ", 1, 0, " + 
        "'" + tipoD + "', '" + descricao + "', '" + data1 + "', '" + posicaoD + "', '" + data1 + "', '" + hora1 + "', '" + solic + "', " + 
        "'INTERNET', 'CASTER OFFICE MOBILE', '" + sistema + "', '" + data1 + "', '" + descricao + "')";
        execSQLQuery(comando, res);
      connection.end();
  });
})

app.get('/ligacoes/novo', verifyJWT, (req, res, next) => {
  let empresa = req.headers['dados-lig-empresa'];
  let ddata = req.headers['dados-lig-data'];
  let hora = req.headers['dados-lig-hora'];
  let contint = req.headers['dados-lig-contint'];
  let context = req.headers['dados-lig-context'];
  let telef = req.headers['dados-lig-telef'];
  let posicao = req.headers['dados-lig-pos'];
  let ddata1 = new Date(ddata);
  let data1 = ddata1.getFullYear() + "-" + parseInt(ddata1.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata1.getDate().toString().padStart(2, "0");
  
  const connection = mysql.createConnection({
    host     : process.env.BDHOST,
    port     : process.env.BDPORT,
    user     : process.env.BDUSER,
    password : process.env.BDPWD,
    database : process.env.BDNAME
  });

  connection.query("select E_MAIL from clientes where nome='" + empresa + "'", function(error, results, fields){
      let email = ''
      for (let i in results) {
        email = results[i]['E_MAIL'];
        break;
      }
        let comando = "insert into rcp (data, hora, contint, context, local, telcont, posicao, tipo, ct, email) " + 
        "values ('" + data1 + "', '" + hora + "', '" + contint + "', '" + context.substr(0, 30) + "', " + 
        "'" + empresa.substr(0, 40) + "', '" + telef.substr(0, 50) + "', '" + posicao.substr(0, 30) + "', " + 
        "'R', 'T', '" + email.substr(0, 50) + "')";
        execSQLQuery(comando, res);
      connection.end();
  });
})

app.get('/visitas/novo', verifyJWT, (req, res, next) => {
  let empresa = req.headers['dados-vis-empresa'];
  let ddata = req.headers['dados-vis-data'];
  let hora = req.headers['dados-vis-hora'];
  let contint = req.headers['dados-vis-contint'];
  let context = req.headers['dados-vis-context'];
  let telef = req.headers['dados-vis-telef'];
  let posicao = req.headers['dados-vis-pos'];
  let ddata1 = new Date(ddata);
  let data1 = ddata1.getFullYear() + "-" + parseInt(ddata1.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata1.getDate().toString().padStart(2, "0");
  
  const connection = mysql.createConnection({
    host     : process.env.BDHOST,
    port     : process.env.BDPORT,
    user     : process.env.BDUSER,
    password : process.env.BDPWD,
    database : process.env.BDNAME
  });

  connection.query("select ENDERECO, BAIRRO, CIDADE from clientes where nome='" + empresa + "'", function(error, results, fields){
      let endereco = '', bairro = '', cidade = ''
      for (let i in results) {
        endereco = results[i]['ENDERECO'];
        bairro = results[i]['BAIRRO'];
        cidade = results[i]['CIDADE'];
        break;
      }
        let comando = "insert into agenda (data, hora, contint, context, local, telcont, descricao, tipo, ct, endereco, bairro, cidade) " + 
        "values ('" + data1 + "', '" + hora + "', '" + contint + "', '" + context.substr(0, 30) + "', " + 
        "'" + empresa.substr(0, 40) + "', '" + telef.substr(0, 30) + "', '" + posicao + "', " + 
        "'P', 'T', '" + endereco.substr(0, 60) + "', '" + bairro.substr(0, 30) + "', '" + cidade.substr(0, 30) + "')";
        execSQLQuery(comando, res);
      connection.end();
  });
})

// Proxy request
var server = http.createServer(app);
var port = process.env.PORT || 3000;
server.listen(port);
