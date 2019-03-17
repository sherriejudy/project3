const db = require("../models");
const {OAuth2Client} = require('google-auth-library');
const client = new OAuth2Client("302735331685-j2de3ss9t9pcmout25hjo0e0lg0d550v.apps.googleusercontent.com");

async function verify(token) {
  const ticket = await client.verifyIdToken({
      idToken: token,
      audience: "302735331685-j2de3ss9t9pcmout25hjo0e0lg0d550v.apps.googleusercontent.com",  
     
  });
  const payload = ticket.getPayload();
  const userid = payload['sub'];
  
  console.log ("user id " + userid);
  // If request specified a G Suite domain:
  //const domain = payload['hd'];
  return payload;
}

/**
 * If user ID exists, refresh the name
 * otherwise, create a new user
 * @param {*} userId 
 * @param {*} name 
 */
async function findUserByUserId (name, email) {

  // upsert on userId
  return db.User.findOneAndUpdate(
    { userId: email},
    {name: name }   ,
    {new: true, upsert: true}
  )
}


// Defining methods for the userController
module.exports = {
    
  /**
    * Finds user by id
    * @param {*} req 
    * @param {*} res 
    */
  findById: function(req, res) {
    db.User  
      .findById(req.params.id)
      .populate("appointmentBookingList")
      .populate("approverList")
      .then(dbModel => res.json(dbModel))
      .catch(err => res.status(422).json(err));
  },

  findUserByToken: function (req, res) {
    // upsert on userId
    const current = new Date();
    var expiryDate = new Date();
    expiryDate.setMinutes = current.getMinutes + 3;
    return db.Session.findOneAndUpdate(
     { tokenId: req.params.token,
      expiryDate: { $gte : current }
    },
     { expiryDate: expiryDate }   ,
     {new: true, upsert: false}
  )
  },

  logout: function (req, res) {
    console.log ("request received to logout");
    res.end();
  },

  /**
   * Retrieves all users in user collection
   * @param {*} req 
   * @param {*} res 
   */
  retrieveAll: function (req, res) {
     db.User.find({})
      .then(dbModel => res.json(dbModel))
      .catch(err =>res.status(422).json(err));
  },
  
  /**
   * Registers an user in the system
   * @param {*} req 
   * @param {*} res 
   */
  register: function(req, res) {
    db.User
      .create(req.body)
      .then(dbModel => res.json(dbModel))
      .catch(err => res.status(422).json(err));
  },

  /**
   * Updates the approver list of a user to allow user to view another user's calendar
   * @param {*} req 
   * @param {*} res 
   */
  updateApproverList: function (req, res) {
    db.User.findOneAndUpdate(
          {_id:  req.body.userId  },
        { $push: { approverList: req.body.clientId } },
         { new: true })   
         .then (updateResult => res.json(updateResult))
         .catch(err => res.status(422).json(err));
  },

 
  /**
   * Validates id token from user
   * if the token is valid, upserts user to user collection
   * @param {*} req 
   * @param {*} res 
   */
  validateOauthID: function (req, res) {

    var token = "";
    // 
    // return new Promise ((resolve, reject ) => { 
    //   token="abc1234def";
    //   resolve({given_name: "f",email: "f@gmail.com"})})
    verify(req.body.idtoken)
    .then(result => {
      console.log ("result from firebase" + JSON.stringify(result));
      if (!(result.name && result.email && result.email_verified)){
        throw err ("invalid token");
      }
      token = result.sub
      return result;
    })
    .then(result => findUserByUserId(result.given_name, result.email))
    .then (user => {
      return  db.Session.findOneAndUpdate(
        {userId: user._id},
        {tokenId: token,
         expiryDate: new Date(),
         userId: user._id,
         name: user.given_name
        },
        {returnNewDocument: true, upsert: true});
    })  
    .then (result => {
      console.log (result);
      res.status(200).json({
        token: result.tokenId
      })})
    .catch(err => {
      console.log (err);
      res.status(422).json(err);
    }); 

  }
}

