const Address = require('../../models/addressSchema');

exports.getAddress = async (req, res) => {
    try {
        const userID = req.session?.user?._id;

        if (!userID) {
            req.flash('error', 'User not authenticated');
            return res.redirect('/login');
        }

        const userAddress = await Address.findOne({ userID });

        res.render('user/address', {
            userAddresses: userAddress ? userAddress.address : [],
            messages: {
                success: req.flash('success'),
                error: req.flash('error')
            }
        });
    } catch (error) {
        console.error('Error fetching address:', error);
        req.flash('error', 'Failed to load addresses');
        res.redirect('/');
    }
};

exports.addAddress = async (req, res) => {
    try {
        const userID = req.session?.user?._id;
        if (!userID) {
            req.flash('error', 'User not authenticated');
            return res.redirect('/login');
        }

        const { addressType, name, address, city, landmark, state, pincode, phone } = req.body;

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

        await userAddress.save();

        req.flash('success', 'Address added successfully');
        res.redirect('/address');

    } catch (error) {
        console.error(error);
        req.flash('error', 'Failed to add address');
        res.redirect('/address');
    }
};

exports.editAddress = async (req, res) => {
    try {
        const address = await Address.findById(req.params.id);
        res.render('/editAddress', { address });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Failed to load address for editing');
        res.redirect('/address');
    }
};

exports.updateAddress = async (req, res) => {
    try {
        const { id } = req.params;
        const userID = req.session?.user?._id;
        const { addressType, name, address, city, landmark, state, pincode, phone } = req.body;

        let userAddress = await Address.findOne({ userID });

        if (!userAddress) {
            req.flash('error', 'User address not found');
            return res.redirect('/address');
        }

        const addressIndex = userAddress.address.findIndex(addr => addr._id.toString() === id);

        if (addressIndex === -1) {
            req.flash('error', 'Specific address not found');
            return res.redirect('/address');
        }

        userAddress.address[addressIndex] = {
            ...userAddress.address[addressIndex],
            addressType,
            name,
            address,
            landmark,
            city,
            state,
            pincode,
            phone
        };

        await userAddress.save();

        req.flash('success', 'Address updated successfully');
        res.redirect('/address');

    } catch (error) {
        console.error('Error updating address:', error);
        req.flash('error', 'Failed to update address');
        res.redirect('/address');
    }
};

exports.setDefaultAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userID = req.session?.user?._id;

        if (!userID) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        let userAddress = await Address.findOne({ userID });

        if (!userAddress) {
            return res.status(404).json({ success: false, message: 'User address not found' });
        }

        userAddress.address = userAddress.address.map(addr => ({
            ...addr,
            isDefault: false
        }));

        const addressIndex = userAddress.address.findIndex(addr => addr._id.toString() === addressId);

        if (addressIndex === -1) {
            return res.status(404).json({ success: false, message: 'Specific address not found' });
        }

        userAddress.address[addressIndex].isDefault = true;

        await userAddress.save();

        req.flash('success', 'Default address updated successfully');
        res.json({ success: true, message: 'Default address updated!' });

    } catch (error) {
        console.error('Error setting default address:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.deleteAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userID = req.session?.user?._id;

        if (!userID) {
            return res.status(401).json({ success: false, message: "Please login to continue" });
        }

        let userAddress = await Address.findOne({ userID });

        if (!userAddress) {
            return res.status(404).json({ success: false, message: "No addresses found" });
        }

        const addressIndex = userAddress.address.findIndex(addr => addr._id.toString() === addressId);

        if (addressIndex === -1) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        userAddress.address.splice(addressIndex, 1);

        await userAddress.save();

        res.status(200).json({ success: true, message: "Address deleted successfully" });

    } catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).json({ success: false, message: "Failed to delete address. Please try again." });
    }
};