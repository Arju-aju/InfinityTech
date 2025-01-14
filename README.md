# InfinityTech E-Commerce Platform

A modern e-commerce platform built with Node.js, Express, and MongoDB, featuring a beautiful admin dashboard with glass-effect UI components.

## 🌟 Features

### Customer Features
- User authentication and authorization
- Product browsing with advanced filters
- Shopping cart management
- Secure checkout process
- Order tracking
- User profile management

### Admin Features
- Modern glass-effect admin dashboard
- Real-time analytics and statistics
- Product management (CRUD operations)
- Category management
- Order management
- Customer management
- Inventory tracking
- Sales reports

## 🚀 Technology Stack

- **Frontend:**
  - EJS (Embedded JavaScript templates)
  - Tailwind CSS
  - JavaScript
  - Glass-effect UI components
  - Responsive design

- **Backend:**
  - Node.js
  - Express.js
  - MongoDB
  - Mongoose ODM

- **Authentication:**
  - JWT (JSON Web Tokens)
  - Session management

- **Other Tools:**
  - Multer (File uploads)
  - Bcrypt (Password hashing)

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/infinitytech.git
cd infinitytech
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your environment variables:
```env
PORT=3000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
```

4. Start the development server:
```bash
npm run dev
```

## 🛠️ Project Structure

```
infinitytech/
├── config/             # Configuration files
├── controllers/        # Route controllers
│   ├── Admin/         # Admin controllers
│   └── User/          # User controllers
├── middleware/        # Custom middleware
├── models/           # Database models
├── public/           # Static files
│   ├── css/
│   ├── js/
│   └── images/
├── routes/           # Route definitions
├── views/            # EJS templates
│   ├── admin/       # Admin views
│   └── user/        # User views
└── app.js           # Application entry point
```

## 🔐 Admin Panel

Access the admin panel at `/admin/login` with the following credentials:
- Email: admin@example.com
- Password: admin123

Features available in the admin panel:
1. Dashboard with real-time statistics
2. Product management
   - Add/Edit/Delete products
   - Manage product images
   - Update stock levels
3. Category management
4. Order management
5. Customer management
6. Sales reports

## 🎨 UI Components

The admin dashboard features a modern design with:
- Glass-effect containers
- Gradient backgrounds
- Animated decorative elements
- Responsive tables
- Interactive modals
- Modern form elements

## 🔧 Development

To run the project in development mode with hot reloading:
```bash
npm run dev
```

For production:
```bash
npm start
```

## 🧪 Testing

Run tests with:
```bash
npm test
```

## 📱 Responsive Design

The platform is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones

## 🔒 Security Features

- Password hashing with bcrypt
- JWT authentication
- Session management
- Input validation
- XSS protection
- CSRF protection

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- Your Name - Initial work - [YourGithub](https://github.com/yourusername)

## 🙏 Acknowledgments

- Thanks to all contributors who have helped shape InfinityTech
- Special thanks to the open-source community for the amazing tools and libraries
