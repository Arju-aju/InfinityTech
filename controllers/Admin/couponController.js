const { render } = require('ejs')
const Coupon = require('../../models/coupounSchema')

exports.getAllCoupon = async (req,res)=>{
    try {
        
        const coupons = await Coupon.find().sort({createdAt:-1})
        res.render('coupon', {
            coupons,
        });
        

    } catch (error) {
        req.flash('error', 'Failed to fetch coupons');
        res.redirect('/');
      }
}