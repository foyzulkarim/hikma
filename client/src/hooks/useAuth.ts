import { useAuth as useAuthContext } from "../context/AuthContext";
import { LoginRequest, RegisterRequest, UpdateProfileRequest, ChangePasswordRequest } from "../types";
import { useToast } from "./useToast";
import { authService } from "../services/authService";
import { useState } from "react";

export const useLogin = () => {
  const { login: contextLogin } = useAuthContext();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const login = async (credentials: LoginRequest) => {
    setIsLoading(true);
    try {
      await contextLogin(credentials);
    } catch (error: any) {
      showToast({ type: "error", title: "Login Failed", message: error.message || "Invalid credentials" });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { login, isLoading };
};

export const useRegister = () => {
  const { register: contextRegister } = useAuthContext();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const register = async (data: RegisterRequest) => {
    setIsLoading(true);
    try {
      await contextRegister(data);
    } catch (error: any) {
      showToast({ type: "error", title: "Registration Failed", message: error.message || "Please check your details" });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { register, isLoading };
};

export const useUpdateProfile = () => {
  const { checkAuth } = useAuthContext();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const updateProfile = async (data: UpdateProfileRequest) => {
    setIsLoading(true);
    try {
      await authService.updateProfile(data);
      await checkAuth(); // Refresh user data in context
      showToast({ type: "success", title: "Profile Updated", message: "Your profile has been successfully updated." });
    } catch (error: any) {
      showToast({ type: "error", title: "Profile Update Failed", message: error.message || "An error occurred." });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { updateProfile, isLoading };
};

export const useChangePassword = () => {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const changePassword = async (data: ChangePasswordRequest) => {
    setIsLoading(true);
    try {
      await authService.changePassword(data);
      showToast({ type: "success", title: "Password Changed", message: "Your password has been updated successfully." });
    } catch (error: any) {
      showToast({ type: "error", title: "Password Change Failed", message: error.message || "An error occurred." });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { changePassword, isLoading };
};

