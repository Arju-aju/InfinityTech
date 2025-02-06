const { error } = require('winston');
const Address = require('../../models/addressSchema') 


exports.getAddress = async (req, res) => {
    try {
        console.log('User ID:', req.session.user);
        const userID = req.session?.user?._id;

        if (!userID) {
            req.flash('error', 'User not authenticated');
            return res.redirect('/login');
        }

        const userAddress = await Address.findOne({ userID });

        console.log('User Address:', userAddress);

        res.render('user/address', {
            userAddresses: userAddress ? userAddress.address : [],  // Ensure it's always an array
            success: req.flash('success'),
            error: req.flash('error')
        });
    } catch (error) {
        console.error('Error fetching address:', error);
        res.status(500).json('Server Error');
    }
};


// addAddress.js
exports.addAddress = async (req, res) => {
    try {
        console.log('Address received >>>', req.body);
        
        const userID = req.session?.user?._id;
        if (!userID) {
            return res.status(400).json({ error: "User not authenticated" });
        }

        const { addressType, name,address, city, landmark, state, pincode, phone} = req.body;

        let userAddress = await Address.findOne({ userID });

        if (!userAddress) {
            userAddress = new Address({ userID, address: [] });
        }

        const newAddress = {
            addressType,
            name,
            address,
            city,
            landmark,
            state,
            pincode,
            phone, 
        };

        userAddress.address.push(newAddress);

        await userAddress.validate(); // Validate before saving

        await userAddress.save();

        // Set flash message
        req.flash('success', 'Address added successfully');

        // Redirect to the address management page
        res.redirect('/address');

    } catch (error) {
        console.error(error);

        if (error.name === 'ValidationError') {
            const errors = {};
            for (const key in error.errors) {
                errors[key] = error.errors[key].message;
            }
            return res.status(400).json({ errors });
        }

        res.status(500).json({ error: "Server Error" });
    }
};

//editAddress

exports.editAddress = async (req,res) => {
    try {
        
        const address = await Address.findById(req.params.id);
        res.render('/editAddress',{address})

    } catch (error) {

        console.error(error)
        res.status(500).json('Server Error')

    }
}

//editAddress

exports.updateAddress = async (req, res) => {
    try {
        const { id } = req.params;  // Extract address ID
        const userID = req.session?.user?._id;  // Get user ID from session
        const { addressType, name, address, city, landmark, state, pincode, phone } = req.body;

        // Log the received data
        console.log('Attempting to update address:', { 
            id, 
            userID, 
            bodyData: req.body 
        });

        // Fetch the user address document
        let userAddress = await Address.findOne({ userID });

        // If no address is found for the user
        if (!userAddress) {
            return res.status(404).json({ error: 'User address not found' });
        }

        // Find the specific address index to update
        const addressIndex = userAddress.address.findIndex(addr => addr._id.toString() === id);

        // If address is not found
        if (addressIndex === -1) {
            console.error('Address not found details:', {
                id,
                addressesInArray: userAddress.address.map(a => a._id.toString())
            });
            return res.status(404).json({ error: 'Specific address not found' });
        }

        // Update the address fields
        userAddress.address[addressIndex] = {
            ...userAddress.address[addressIndex],
            addressType,  // Update fields with new data
            name,
            address,
            landmark,
            city,
            state,
            pincode,
            phone
        };

        // Save the updated address
        await userAddress.save();

        req.flash('success', 'Address updated successfully');
        res.redirect('/address');

    } catch (error) {
        console.error('Error updating address:', error);

        // Check for validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: 'Invalid address data' });
        }

        // General server error
        res.status(500).json({ error: 'Server Error' });
    }
};
