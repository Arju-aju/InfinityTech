const Address = require('../../models/addressSchema') 


exports.getAddress = async (req,res) => {
    try {
        console.log('user id.......',req.user)
        // const userID = req.session.user._id;
        // const userAddress  = await Address.findOne({userID})
        // console.log('userAddress...',userAddress)
        res.render('user/address')
    } catch (error) {
        console.error(error)
        res.status(500).json('Server Error')
    }
}

exports.addAddress = async (req,res) => {
    try {

        const userId = req.session.user._id
        const { addressType, name, city, landmark, state, pincode, phone, altPhone } = req.body;

        let userAddress = await Address.findOne({userId})

        if(!userAddress){
            userAddress =  new Address({userId,address:[]})
        }
        userAddress.address.push({ addressType, name, city, landmark, state, pincode, phone, altPhone })
        await userAddress.save()

        res.redirect('/user/address')

    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
}