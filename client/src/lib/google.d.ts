interface Window {
  google?: {
    accounts: {
      id: {
        initialize(config: {
          client_id: string;
          callback: (response: { credential: string }) => void;
        }): void;
        renderButton(
          parent: HTMLElement,
          options: {
            theme?: "outline" | "filled_black" | "filled_blue";
            size?: "small" | "medium" | "large";
            width?: number;
            text?: "signin_with" | "signup_with" | "continue_with";
          }
        ): void;
      };
    };
  };
}
