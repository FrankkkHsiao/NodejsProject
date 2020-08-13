const express = require('express');
const url = require('url');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer({ dest: 'tmp_uploads/' });
const fs = require('fs');
const session = require('express-session');
const moment = require('moment-timezone');
const db = require(__dirname + '/db-connect');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

/////////////    session    ////////////////////////////
app.use(session({
    saveUninitialized: false,
    resave: false,
    secret: 'ksdhkasjhfjs',
    cookie: {
        maxAge: 10000000
    }
}));

//////////////////////////////////////
app.get('/', (req, res) => {
    const output = {
        pageName: 'Home Page',
        loginUser: req.session.loginUser,
        userSid: req.session.userSid,
        userPerm: req.session.userPerm
    };
    res.render('parts/index', output);
});

/////////////     Login    ////////////////////////////
app.get('/login', (req, res) => {
    let data = {
        // flashMsg: req.session.flashMsg || '',
        loginUser: req.session.loginUser,
        userSid: req.session.userSid,
        userPerm: req.session.userPerm
    };
    // delete req.session.flashMsg;
    res.render('parts/login', data);
});

app.post('/login', (req, res) => {
    const output = {
        success: false,
        code: 400,
        results: {},
        errorMsg: '',
        body: req.body
    };
    let sql = "SELECT account, password, sid, permission FROM member_info WHERE account = ?"
    db.queryAsync(sql, [req.body.loginAccount])
        .then(results => {
            if (results.length === 0 || req.body.loginPassword != results[0].password) {
                output.errorMsg = '帳號或密碼錯誤!';
                // console.log(results[0].password);
                res.json(output);
            }
            else {
                req.session.loginUser = req.body.loginAccount;
                req.session.userSid = results[0].sid;
                req.session.userPerm = results[0].permission;
                output.success = true;
                res.json(output);
            }
            console.log('123');
        })
        .catch(error => {
            console.log(error);
        });
    // res.render('parts/login');
});

/////////////     Logout    ////////////////////////////
app.get('/logout', (req, res) => {
    delete req.session.loginUser;
    delete req.session.userSid;
    delete req.session.userPerm;
    res.redirect('/login');
});


/////////////     DB       ///////////////////////////
app.get('/memberList/:page?', (req, res) => {
    const perPage = 10;
    const output = {
        perPage: perPage,
        pageName: 'memberList',
        loginUser: req.session.loginUser,
        userSid: req.session.userSid,
        userPerm: req.session.userPerm
    };
    let page = parseInt(req.params.page) || 1;
    const birthFm = 'YYYY-MM-DD';
    const createdFm = 'YYYY-MM-DD HH:mm:ss';
    output.page = page;

    let sql1 = "SELECT COUNT(1) num FROM member_info";
    let sql2 = `SELECT * FROM member_info ORDER BY sid DESC LIMIT ${(page - 1) * perPage}, ${perPage}`;
    let sql3 = "SELECT * FROM member_info WHERE sid = ?";
    if (req.session.userPerm == 1) {
        db.queryAsync(sql1)
            .then(results => {
                output.total = results[0].num;
                output.totalPages = Math.ceil(output.total / perPage);

                if (page < 1 || page > output.totalPages) {
                    return res.redirect('/memberList');
                }
                return db.queryAsync(sql2);
            })
            .then(results => {
                for (let i of results) {
                    i.birth = moment(i.birth).format(birthFm);
                    i.created_time = moment(i.created_time).format(createdFm);
                    if (i.gender == 1) {
                        i.gender = '男';
                    }
                    else {
                        i.gender = '女';
                    }
                }
                output.rows = results;
                res.render('parts/memberList', output);
            })
            .catch(error => {
                console.log(error);
            });
    }
    else {
        db.queryAsync(sql3, [req.session.userSid])
            .then(results => {
                for (let i of results) {
                    i.birth = moment(i.birth).format(birthFm);
                    i.created_time = moment(i.created_time).format(createdFm);
                    if (i.gender == 1) {
                        i.gender = '男';
                    }
                    else {
                        i.gender = '女';
                    }
                }
                output.rows = results;
                res.render('parts/memberList', output);
            })
            .catch(error => {
                console.log(error);
            });
    };
});

//////////////    Insert       //////////////////////////////////

app.get('/memberRegister', (req, res) => {
    const output = {
        pageName: 'memberRegister'
    }
    let sql1 = "SELECT * FROM city";
    let sql2 = "SELECT * FROM citydistrict";
    db.queryAsync(sql1)
        .then(results => {
            output.cities = results;
            return db.queryAsync(sql2);
        })
        .then(results => {
            output.districts = results;
            res.render('parts/memberRegister', output);
        })
        .catch(error => {
            console.log(error);
        });
});

app.post('/memberRegister', (req, res) => {
    const output = {
        success: false,
        code: 400,
        results: {},
        errorMsg: '',
        body: req.body
    };
    const sql1 = "SELECT account FROM member_info WHERE account = ?"
    db.queryAsync(sql1, [req.body.inputAccount])
        .then(results => {
            if (results.length === 0) {

                const sql2 = "INSERT INTO `member_info`(`account`, `name`, `password`, `gender`, `birth`, `idNo`, `mobile`, `email`, `address`, `created_time`) VALUES (?,?,?,?,?,?,?,?,?, NOW())";
                db.queryAsync(sql2, [
                    req.body.inputAccount,
                    req.body.inputName,
                    req.body.inputPassword1,
                    req.body.gender,
                    req.body.inputBirthYear + '-' + req.body.inputBirthMonth + '-' + req.body.inputBirthDay,
                    req.body.inputIdno,
                    req.body.inputPhoneNo,
                    req.body.inputEmail,
                    req.body.inputAddress,
                ])
                    .then(results => {
                        output.results = results;
                        if (results.affectedRows === 1) {
                            output.success = true;
                            output.code = 200;
                        } else {
                            output.code = 420;
                            output.errorMsg = '資料新增失敗';
                        }
                        res.json(output);
                    })
                    .catch(error => {
                        console.log(error);
                    });
            }
            else {
                output.errorMsg = '此帳號已被使用!';
                res.json(output);
            }

        })
        .catch(error => {
            console.log(error);
        });
});

///////////////////// Remove ///////////////////
app.get('/memberRemove/:sid', (req, res) => {
    let sql = "DELETE FROM member_info WHERE sid = ?";
    db.queryAsync(sql, [req.params.sid])
        .then(results => {
            console.log('results');
            let backTo = req.header.referer || "/memberList";
            res.redirect(backTo);
        })
});

/////////////////  member Edit   /////////////////////////////

app.get('/memberEdit/:sid', (req, res) => {
    const output = {
        pageName: 'memberEdit',
        loginUser: req.session.loginUser,
        userSid: req.session.userSid,
        userPerm: req.session.userPerm
    }
    let sql1 = "SELECT * FROM member_info WHERE sid = ?";
    if (req.session.userPerm == 1) {
        db.queryAsync(sql1, [req.params.sid])
            .then(results => {
                if (!results.length) {
                    return req.redirect('/memberList');
                }
                else {
                    // results[0].birthday = moment(results[0].birthday).format('YYYY-MM-DD');
                    if (results[0].gender == 1) {
                        results[0].gender = '男';
                    }
                    else {
                        results[0].gender = '女';
                    }

                    res.render('parts/memberEdit', {
                        data: results[0]
                    });
                }
            }).catch(error => {
                console.log(error);
            });
    }
    else{
        db.queryAsync(sql1, [req.session.userSid])
            .then(results => {
                if (!results.length) {
                    return req.redirect('/memberList');
                }
                else {
                    // results[0].birthday = moment(results[0].birthday).format('YYYY-MM-DD');
                    if (results[0].gender == 1) {
                        results[0].gender = '男';
                    }
                    else {
                        results[0].gender = '女';
                    }

                    res.render('parts/memberEdit', {
                        data: results[0]
                    });
                }
            }).catch(error => {
                console.log(error);
            });
    }
});

app.post('/memberEdit/:sid', (req, res) => {
    // TODO: 資料檢查
    const output = {
        success: false,
        code: 400,
        results: {},
        errorMsg: '',
        body: req.body
    };
    const sql = "UPDATE \`member_info\` SET \`name\`=?,\`birth\`=?,\`mobile\`=?,\`email\`=?,\`address\`=? WHERE \`sid\`=?";
    db.queryAsync(sql, [
        req.body.inputName,
        req.body.inputBirthYear + '-' + req.body.inputBirthMonth + '-' + req.body.inputBirthDay,
        req.body.inputPhoneNo,
        req.body.inputEmail,
        req.body.inputAddress,
        req.params.sid
    ])
        .then(results => {
            output.results = results;
            if (results.affectedRows === 1) {
                output.success = true;
                output.code = 200;
            } else {
                output.code = 420;
                output.errorMsg = '資料沒有修改';
            }
            res.json(output);
        })
        .catch(error => {
            //output
        });
});

/////////////////  PW Edit   /////////////////////////////

app.get('/pwEdit/:sid', (req, res) => {
    const output = {
        pageName: 'pwEdit',
        loginUser: req.session.loginUser,
        userSid: req.session.userSid,
        userPerm: req.session.userPerm
    }
    let sql1 = "SELECT password, sid FROM member_info WHERE sid = ?";

    db.queryAsync(sql1, [req.session.userSid])
        .then(results => {
            if (!results.length) {
                return req.redirect('/memberList');
            }
            else {
                res.render('parts/pwEdit', {
                    data: results[0]
                });
            }
        }).catch(error => {
            console.log(error);
        });

    // res.render('parts/pwEdit', output);


});

app.post('/pwEdit/:sid', (req, res) => {
    // TODO: 資料檢查
    const output = {
        success: false,
        code: 400,
        results: {},
        errorMsg: '',
        body: req.body
    };
    const sql1 = "SELECT password FROM member_info WHERE sid = ?"
    db.queryAsync(sql1, [req.session.userSid])
        .then(results => {
            console.log(results[0].password);
            if (results[0].password == req.body.inputOldPassword) {

                const sql2 = "UPDATE \`member_info\` SET \`password\`=? WHERE \`sid\`=?";
                db.queryAsync(sql2, [
                    req.body.inputNewPassword1,
                    req.session.userSid,
                ])
                    .then(results => {
                        output.results = results;
                        if (results.affectedRows === 1) {
                            output.success = true;
                            output.code = 200;
                        } else {
                            output.code = 420;
                            output.errorMsg = '密碼修改失敗';
                        }
                        res.json(output);
                    })
                    .catch(error => {
                        console.log(error);
                    });
            }
            else {
                output.errorMsg = '舊密碼輸入錯誤!';
                res.json(output);
            }

        })
        .catch(error => {
            console.log(error);
        });
});

/////////////    404  要在 routes 的最後面  /////////////////////////
app.use((req, res) => {
    res.type('text/plain');
    res.status(404);
    res.send('404 !!');
})

app.listen(3000, function () {
    console.log('啟動 server 偵聽 3000');
});