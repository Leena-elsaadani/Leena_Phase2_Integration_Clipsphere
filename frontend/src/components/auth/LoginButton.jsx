const LoginButton = ({ onClick, text = 'Login with GitHub' }) => {
  return (
    <button onClick={onClick}>{text}</button>
  );
};

export default LoginButton;