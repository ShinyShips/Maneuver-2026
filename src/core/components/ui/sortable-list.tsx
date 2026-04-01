import { type Dispatch, type PointerEvent as ReactPointerEvent, type ReactNode, type SetStateAction, useState } from "react"
import { GripVertical, Trash } from "lucide-react"
import {
    AnimatePresence,
    LayoutGroup,
    Reorder,
    motion,
    useDragControls,
} from "motion/react"
import useMeasure from "react-use-measure"

import { cn } from "@/core/lib/utils"
import { Checkbox } from "@/core/components/animate-ui/radix/checkbox"

export type Item = {
    text: string
    checked: boolean
    id: number
    description?: string
    teamNumber: number
}

interface SortableListItemProps {
    item: Item
    order: number
    onCompleteItem: (id: number) => void
    onRemoveItem: (id: number) => void
    renderExtra?: (item: Item) => React.ReactNode
    isExpanded?: boolean
    className?: string
    handleDrag: () => void
}

function SortableListItem({
    item,
    order,
    onCompleteItem,
    onRemoveItem,
    renderExtra,
    handleDrag,
    isExpanded,
    className,
}: SortableListItemProps) {
    const [ref, bounds] = useMeasure()
    const [isDragging, setIsDragging] = useState(false)
    const dragControls = useDragControls()

    const handleDragStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
        setIsDragging(true)
        event.preventDefault()
        dragControls.start(event)
        handleDrag()
    }

    const handleDragEnd = () => {
        setIsDragging(false)
    }

    return (
        <motion.div className={cn("", className)} key={item.id}>
            <div className="flex w-full items-center">
                <Reorder.Item
                    value={item}
                    className={cn(
                        "relative z-auto grow",
                        "h-full rounded-xl bg-background/40 mb-1",
                        "shadow-[0px_1px_0px_0px_hsla(0,0%,100%,.03)_inset,0px_0px_0px_1px_hsla(0,0%,100%,.03)_inset,0px_0px_0px_1px_rgba(0,0,0,.1),0px_2px_2px_0px_rgba(0,0,0,.1),0px_4px_4px_0px_rgba(0,0,0,.1),0px_8px_8px_0px_rgba(0,0,0,.1)]",
                        item.checked ? "cursor-not-allowed" : "cursor-grab",
                        item.checked && !isDragging ? "w-7/10" : "w-full"
                    )}
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{
                        opacity: 1,
                        height: bounds.height > 0 ? bounds.height : undefined,
                        transition: {
                            type: "spring",
                            bounce: 0,
                            duration: 0.4,
                        },
                    }}
                    exit={{
                        opacity: 0,
                        transition: {
                            duration: 0.05,
                            type: "spring",
                            bounce: 0.1,
                        },
                    }}
                    layout
                    layoutId={`item-${item.id}`}
                    dragListener={false}
                    dragControls={dragControls}
                    onDragEnd={handleDragEnd}
                    style={
                        isExpanded
                            ? {
                                zIndex: 9999,
                                marginTop: 10,
                                marginBottom: 10,
                                position: "relative",
                                overflow: "hidden",
                            }
                            : {
                                position: "relative",
                                overflow: "hidden",
                            }
                    }
                    whileDrag={{ zIndex: 9999 }}
                >
                    <div ref={ref} className={cn(isExpanded ? "" : "", "z-20 ")}>
                        <motion.div
                            layout="position"
                            className="flex items-center justify-center "
                        >
                            <AnimatePresence>
                                {!isExpanded ? (
                                    <motion.div
                                        initial={{ opacity: 0, filter: "blur(4px)" }}
                                        animate={{ opacity: 1, filter: "blur(0px)" }}
                                        exit={{ opacity: 0, filter: "blur(4px)" }}
                                        transition={{ duration: 0.001 }}
                                        className="flex  items-center space-x-2 "
                                    >
                                        {/* List Remove Actions */}
                                        <Checkbox
                                            checked={item.checked}
                                            id={`checkbox-${item.id}`}
                                            aria-label="Mark to delete"
                                            onCheckedChange={() => onCompleteItem(item.id)}
                                            className=" ml-3 h-5 w-5 rounded-md border-white/20 data-[state=checked]:bg-black data-[state=checked]:text-red-200"
                                        />
                                        <button
                                            type="button"
                                            aria-label={`Drag ${item.text}`}
                                            disabled={item.checked}
                                            onPointerDown={item.checked ? undefined : handleDragStart}
                                            className={cn(
                                                "ml-1 inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-white/60 transition-colors",
                                                item.checked
                                                    ? "cursor-not-allowed opacity-40"
                                                    : "cursor-grab active:cursor-grabbing"
                                            )}
                                            style={{ touchAction: "none" }}
                                        >
                                            <GripVertical className="h-4 w-4 shrink-0" />
                                            <span className="font-mono text-xs">{order + 1}</span>
                                        </button>

                                        {/* List Title */}
                                        <motion.div
                                            key={`${item.checked}`}
                                            className=" px-1 min-w-[150px]"
                                            initial={{
                                                opacity: 0,
                                                filter: "blur(4px)",
                                            }}
                                            animate={{ opacity: 1, filter: "blur(0px)" }}
                                            transition={{
                                                bounce: 0.2,
                                                delay: item.checked ? 0.2 : 0,
                                                type: "spring",
                                            }}
                                        >
                                            <h4
                                                className={cn(
                                                    "tracking-tighter text-base md:text-lg ",
                                                    item.checked ? "text-red-400" : ""
                                                )}
                                            >
                                                {item.text}
                                            </h4>
                                        </motion.div>
                                    </motion.div>
                                ) : null}
                            </AnimatePresence>

                            {/* List Item Children */}
                            {renderExtra && renderExtra(item)}
                        </motion.div>
                    </div>
                </Reorder.Item>
                {/* List Delete Action Animation */}
                <AnimatePresence mode="popLayout">
                    {item.checked ? (
                        <motion.div
                            layout
                            initial={{ opacity: 0, x: -10 }}
                            animate={{
                                opacity: 1,
                                x: 0,
                                transition: {
                                    delay: 0.17,
                                    duration: 0.17,
                                    type: "spring",
                                    bounce: 0.6,
                                },
                                zIndex: 5,
                            }}
                            exit={{
                                opacity: 0,
                                x: -5,
                                transition: {
                                    delay: 0,
                                    duration: 0.0,
                                    type: "spring",
                                    bounce: 0,
                                },
                            }}
                            className="-ml-[1px] h-[1.5rem] w-3 rounded-l-none  rounded-r-none border-y border-r border-border/20 dark:border-background/5 dark:border-r-background/10 bg-background/40"
                        />
                    ) : null}
                </AnimatePresence>
                <AnimatePresence mode="popLayout">
                    {item.checked ? (
                        <motion.div
                            layout
                            initial={{ opacity: 0, x: -5, filter: "blur(4px)" }}
                            animate={{
                                opacity: 1,
                                x: 0,
                                filter: "blur(0px)",
                                transition: {
                                    delay: 0.3,
                                    duration: 0.15,
                                    type: "spring",
                                    bounce: 0.9,
                                },
                            }}
                            exit={{
                                opacity: 0,
                                filter: "blur(4px)",
                                x: -10,
                                transition: { delay: 0, duration: 0.12 },
                            }}
                            className="inset-0 z-0 border-spacing-1  rounded-r-xl rounded-l-sm border-r-2   border-r-red-300/60 bg-background/40 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_0_0_1px_rgba(255,255,255,0.03)_inset,0_0_0_1px_rgba(0,0,0,0.1),0_2px_2px_0_rgba(0,0,0,0.1),0_4px_4px_0_rgba(0,0,0,0.1),0_8px_8px_0_rgba(0,0,0,0.1)]"
                        >
                            <button
                                className="inline-flex bg-background/40 h-10 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium  transition-colors duration-150   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                                onClick={() => onRemoveItem(item.id)}
                            >
                                <Trash className="h-4 w-4 text-red-400 transition-colors duration-150 fill-red-400/60 " />
                            </button>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>
        </motion.div>
    )
}

SortableListItem.displayName = "SortableListItem"

interface SortableListProps {
    items: Item[]
    setItems: Dispatch<SetStateAction<Item[]>>
    onCompleteItem: (id: number) => void
    renderItem: (
        item: Item,
        order: number,
        onCompleteItem: (id: number) => void,
        onRemoveItem: (id: number) => void
    ) => ReactNode
}

function SortableList({
    items,
    setItems,
    onCompleteItem,
    renderItem,
}: SortableListProps) {
    if (items) {
        return (
            <LayoutGroup>
                <Reorder.Group
                    axis="y"
                    values={items}
                    onReorder={setItems}
                    className="flex flex-col"
                >
                    <AnimatePresence>
                        {items?.map((item, index) =>
                            renderItem(item, index, onCompleteItem, (id: number) =>
                                setItems((items) => items.filter((item) => item.id !== id))
                            )
                        )}
                    </AnimatePresence>
                </Reorder.Group>
            </LayoutGroup>
        )
    }
    return null
}

SortableList.displayName = "SortableList"

export { SortableList, SortableListItem }
export default SortableList
