import type { ReactNode, ButtonHTMLAttributes, CSSProperties } from "react";
export function Step(props: {
  children?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
}): ReactNode;
export default function Stepper(props: {
  children: ReactNode;
  step?: number;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  linear?: boolean;
  disableStepIndicators?: boolean;
  theme?: "light" | "dark";
  accentColor?: string;
  width?: string | number;
  radius?: number;
  transition?: "slide" | "fade" | "none";
  backButtonText?: string;
  nextButtonText?: string;
  completeButtonText?: string;
  nextButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  backButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  className?: string;
  style?: CSSProperties;
}): ReactNode;
