import { HardDrive, LockKeyhole, ShieldCheck } from "lucide-react";
import { type ReactNode } from "react";
import {
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";

import { Button } from "./Button";
import { AlertDialog } from "./Dialog";
import { formatBytes } from "./formatBytes";

export interface PrivacyDialogProps {
  trigger?: ReactNode;
}

export function PrivacyDialog({ trigger }: PrivacyDialogProps) {
  return (
    <DialogTrigger>
      {trigger ?? (
        <Button variant="ghost" size="sm">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Quyền riêng tư
        </Button>
      )}
      <ModalOverlay
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]"
        isDismissable
      >
        <Modal className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl outline-none">
          <Dialog className="p-6 outline-none sm:p-7">
            <div className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <LockKeyhole className="size-6" aria-hidden="true" />
            </div>
            <Heading
              slot="title"
              className="mt-4 text-balance text-xl font-bold text-slate-950"
            >
              Tệp của bạn không rời thiết bị
            </Heading>
            <div className="mt-3 space-y-3 text-pretty text-sm leading-6 text-slate-600">
              <p>
                PDF Tools xử lý tài liệu ngay trong bộ nhớ của tab này. Không có
                tệp nào được tải lên máy chủ.
              </p>
              <p>
                Khi bạn làm lại, đóng tab hoặc tải lại trang, dữ liệu của phiên
                hiện tại sẽ bị xóa. Ứng dụng không dùng tài liệu để phân tích hay
                theo dõi.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <Button slot="close" variant="primary">
                Đã hiểu
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

export interface LargeFileWarningDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  totalBytes: number;
  totalPages?: number;
  onContinue: () => void;
  onCancel?: () => void;
}

export function LargeFileWarningDialog({
  isOpen,
  onOpenChange,
  totalBytes,
  totalPages,
  onContinue,
  onCancel,
}: LargeFileWarningDialogProps) {
  const pageSummary =
    totalPages === undefined
      ? ""
      : ` và ${totalPages.toLocaleString("vi-VN")} trang`;

  return (
    <AlertDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Tệp lớn có thể làm trình duyệt chậm"
      description={
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-amber-950">
            <HardDrive
              className="mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <p>
              Phiên này có tổng dung lượng {formatBytes(totalBytes)}
              {pageSummary}.
            </p>
          </div>
          <p>
            Bạn có thể tiếp tục, nhưng thao tác có thể mất nhiều thời gian hoặc
            hết bộ nhớ, đặc biệt trên điện thoại.
          </p>
        </div>
      }
      confirmLabel="Vẫn tiếp tục"
      cancelLabel="Hủy"
      onConfirm={onContinue}
      onCancel={onCancel}
    />
  );
}
