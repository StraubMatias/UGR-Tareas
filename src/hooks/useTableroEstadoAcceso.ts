import { useState } from 'react';

export function useTableroEstadoAcceso() {
  const [usuarioActual, setUsuarioActual] = useState<string | null>(null);
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [origenCuenta, setOrigenCuenta] = useState<string | null>(null);
  const [ugrUsuarioCuenta, setUgrUsuarioCuenta] = useState<string | null>(null);
  const [modoAcceso, setModoAcceso] = useState<'login' | 'registro'>('login');
  const [registroPass, setRegistroPass] = useState('');
  const [registroConfirmacion, setRegistroConfirmacion] = useState('');
  const [enviandoAcceso, setEnviandoAcceso] = useState(false);
  const [inputUser, setInputUser] = useState('');
  const [inputPass, setInputPass] = useState('');
  const [errorLogin, setErrorLogin] = useState('');
  const [modalPasswordOpen, setModalPasswordOpen] = useState(false);
  const [userPassChange, setUserPassChange] = useState('');
  const [currentPassChange, setCurrentPassChange] = useState('');
  const [newPassChange, setNewPassChange] = useState('');
  const [nuevoUserChange, setNuevoUserChange] = useState('');
  const [msgPassChange, setMsgPassChange] = useState({ tipo: '', texto: '' });

  return {
    usuarioActual,
    setUsuarioActual,
    rolUsuario,
    setRolUsuario,
    origenCuenta,
    setOrigenCuenta,
    ugrUsuarioCuenta,
    setUgrUsuarioCuenta,
    modoAcceso,
    setModoAcceso,
    registroPass,
    setRegistroPass,
    registroConfirmacion,
    setRegistroConfirmacion,
    enviandoAcceso,
    setEnviandoAcceso,
    inputUser,
    setInputUser,
    inputPass,
    setInputPass,
    errorLogin,
    setErrorLogin,
    modalPasswordOpen,
    setModalPasswordOpen,
    userPassChange,
    setUserPassChange,
    currentPassChange,
    setCurrentPassChange,
    newPassChange,
    setNewPassChange,
    nuevoUserChange,
    setNuevoUserChange,
    msgPassChange,
    setMsgPassChange
  };
}
