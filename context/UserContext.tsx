import React, { createContext, useContext, useState } from "react";

interface UserContextType {
  userId: string;
  userName: string;
  setUserInfo: (name: string) => void;
  isLoggedIn: boolean;
}

const UserContext = createContext<UserContextType>({
  userId: "",
  userName: "",
  setUserInfo: () => {},
  isLoggedIn: false,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId] = useState(
    () => Math.random().toString(36).substring(2, 10)
  );
  const [userName, setUserName] = useState("");

  const setUserInfo = (name: string) => {
    setUserName(name.trim());
  };

  return (
    <UserContext.Provider
      value={{
        userId,
        userName,
        setUserInfo,
        isLoggedIn: userName.trim().length > 0,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
