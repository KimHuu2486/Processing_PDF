import {
  Camera,
  Crop,
  FileImage,
  Files,
  ListOrdered,
  Merge,
  Scissors,
  type LucideIcon,
} from "lucide-react";
import { lazy, type ComponentType } from "react";

const MergeTool = lazy(() =>
  import("../features/merge/MergeTool").then((module) => ({
    default: module.MergeTool,
  })),
);
const SplitTool = lazy(() =>
  import("../features/split/SplitTool").then((module) => ({
    default: module.SplitTool,
  })),
);
const OrganizeTool = lazy(() =>
  import("../features/organize/OrganizeTool").then((module) => ({
    default: module.OrganizeTool,
  })),
);
const PageNumbersTool = lazy(() =>
  import("../features/pageNumbers/PageNumbersTool").then((module) => ({
    default: module.PageNumbersTool,
  })),
);
const ImagesToPdfTool = lazy(() =>
  import("../features/images/ImagesToPdfTool").then((module) => ({
    default: module.ImagesToPdfTool,
  })),
);
const ScanToPdfTool = lazy(() =>
  import("../features/scan/ScanToPdfTool").then((module) => ({
    default: module.ScanToPdfTool,
  })),
);
const CropTool = lazy(() =>
  import("../features/crop/CropTool").then((module) => ({
    default: module.CropTool,
  })),
);

export type ToolRouteId =
  | "merge"
  | "split"
  | "organize"
  | "page-numbers"
  | "images-to-pdf"
  | "scan-to-pdf"
  | "crop";

export interface ToolRoute {
  id: ToolRouteId;
  path: `/${ToolRouteId}`;
  hash: `#/${ToolRouteId}`;
  title: string;
  shortTitle: string;
  description: string;
  icon: LucideIcon;
  component: ComponentType;
}

export const toolRoutes: readonly ToolRoute[] = [
  {
    id: "merge",
    path: "/merge",
    hash: "#/merge",
    title: "Gộp PDF",
    shortTitle: "Gộp",
    description: "Kết hợp nhiều tài liệu theo đúng thứ tự bạn chọn.",
    icon: Merge,
    component: MergeTool,
  },
  {
    id: "split",
    path: "/split",
    hash: "#/split",
    title: "Tách PDF",
    shortTitle: "Tách",
    description: "Trích một khoảng trang liên tục thành tệp PDF mới.",
    icon: Scissors,
    component: SplitTool,
  },
  {
    id: "organize",
    path: "/organize",
    hash: "#/organize",
    title: "Sắp xếp PDF",
    shortTitle: "Sắp xếp",
    description: "Đổi thứ tự, xoay hoặc xóa các trang trong tài liệu.",
    icon: Files,
    component: OrganizeTool,
  },
  {
    id: "page-numbers",
    path: "/page-numbers",
    hash: "#/page-numbers",
    title: "Đánh số trang",
    shortTitle: "Đánh số",
    description: "Thêm số trang với vị trí, cỡ chữ và phạm vi tùy chọn.",
    icon: ListOrdered,
    component: PageNumbersTool,
  },
  {
    id: "images-to-pdf",
    path: "/images-to-pdf",
    hash: "#/images-to-pdf",
    title: "Ảnh sang PDF",
    shortTitle: "Ảnh sang PDF",
    description: "Ghép nhiều ảnh JPG hoặc PNG vào một tài liệu PDF.",
    icon: FileImage,
    component: ImagesToPdfTool,
  },
  {
    id: "scan-to-pdf",
    path: "/scan-to-pdf",
    hash: "#/scan-to-pdf",
    title: "Quét sang PDF",
    shortTitle: "Quét",
    description: "Chụp tài liệu bằng camera hoặc chọn ảnh có sẵn.",
    icon: Camera,
    component: ScanToPdfTool,
  },
  {
    id: "crop",
    path: "/crop",
    hash: "#/crop",
    title: "Cắt lề PDF",
    shortTitle: "Cắt lề",
    description: "Điều chỉnh vùng hiển thị của một hoặc nhiều trang.",
    icon: Crop,
    component: CropTool,
  },
] as const;
