/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366F1', // Indigo
          dark: '#4F46E5',
          light: '#818CF8'
        },
        secondary: {
          DEFAULT: '#EC4899', // Pink
          dark: '#DB2777',
          light: '#F472B6'
        },
        accent: {
          DEFAULT: '#10B981', // Emerald
          dark: '#059669',
          light: '#34D399'
        },
        background: {
          DEFAULT: '#F9FAFB',
          dark: '#1F2937',
          card: '#FFFFFF'
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.5s ease-out',
        'bounce-slow': 'bounce 3s infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/aspect-ratio')
  ]
}
