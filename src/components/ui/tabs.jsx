// @ts-nocheck
// This is a JSX compatibility adapter around Ten4Seven's typed item API.
// Route files still author the legacy marker children while the renderer is
// canonical; TypeScript cannot infer those runtime marker props in checkJs.
import * as React from "react";
import { TabPanel, Tabs as CanonicalTabs } from "@ten4seven/ui";
import { cn } from "@/lib/utils";

/*
 * Compatibility markers let existing route content keep its declarative
 * TabsList/TabsTrigger/TabsContent shape while the rendered interaction,
 * keyboard model, and visual anatomy come from the canonical Ten4Seven Tabs.
 * They intentionally do not render DOM of their own.
 */
const tabListMarker = () => null;
const tabTriggerMarker = () => null;
const tabContentMarker = () => null;

function AcademyTabs({
  children,
  className,
  defaultValue,
  label,
  onValueChange,
  value,
  ...props
}) {
  const nodes = React.Children.toArray(children).filter(React.isValidElement);
  const listNode = nodes.find((node) => node.type === tabListMarker);
  const contentNodes = nodes.filter((node) => node.type === tabContentMarker);
  const triggerNodes = React.Children.toArray(listNode?.props?.children)
    .filter(React.isValidElement)
    .filter((node) => node.type === tabTriggerMarker);

  const triggersByValue = new Map(
    triggerNodes.map((node) => [String(node.props.value), node.props]),
  );

  const items = contentNodes.map((node) => {
    const id = String(node.props.value);
    const trigger = triggersByValue.get(id);

    return {
      id,
      label: trigger?.children ?? id,
      disabled: Boolean(trigger?.disabled),
      content: (
        <TabPanel className={cn("mt-5", node.props.className)}>
          {node.props.children}
        </TabPanel>
      ),
    };
  });

  return (
    <CanonicalTabs
      {...props}
      className={className}
      defaultValue={defaultValue}
      items={items}
      label={label}
      onValueChange={onValueChange}
      value={value}
    />
  );
}

export {
  AcademyTabs as Tabs,
  tabListMarker as TabsList,
  tabTriggerMarker as TabsTrigger,
  tabContentMarker as TabsContent,
};
