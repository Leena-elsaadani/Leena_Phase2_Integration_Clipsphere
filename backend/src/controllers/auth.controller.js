import authService from "../services/auth.service.js";

export const register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({ status: 'success', data: { user } });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { user, token } = await authService.login(req.body);

    // Set JWT as HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,        // JS cannot access this cookie
      secure: false,         // set to true in production (HTTPS only)
      sameSite: 'lax',       // protects against CSRF
      domain: 'localhost',   // allow sharing between localhost:3000 and localhost:5000
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });

    res.json({ status: 'success', data: { user } });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res) => {
  // Clear the cookie by setting maxAge to 0
  res.cookie('token', '', {
    httpOnly: true,
    maxAge: 0,
  });
  res.json({ status: 'success', message: 'Logged out successfully' });
};