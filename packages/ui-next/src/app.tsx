import React from "react";
import { MantineProvider, AppShell, Group, Burger, Title, Container, Text, NavLink, Stack, ThemeIcon } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
// Icons: install @tabler/icons-react for real icons
import { mergedHydroTheme } from "./theme";
import { Link } from "./components/link";
import { usePageData } from "./context/page-data";
import { defineSlot } from "./registry";

/** Navigation link item */
const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  to: string;
  active?: boolean;
}> = ({ icon, label, to, active }) => (
  <NavLink
    component={Link}
    to={to}
    label={label}
    leftSection={<ThemeIcon variant="light" size="sm">{icon}</ThemeIcon>}
    active={active}
    variant="filled"
  />
);

const AppInner = defineSlot("page:app", () => {
  const data = usePageData();
  const [opened, { toggle }] = useDisclosure(false);

  return (
    <MantineProvider
      theme={mergedHydroTheme}
      defaultColorScheme="dark"
      forceColorScheme="dark"
    >
      <AppShell
        header={{ height: 56 }}
        navbar={{
          width: 260,
          breakpoint: "sm",
          collapsed: { mobile: !opened },
        }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group>
              <Burger
                opened={opened}
                onClick={toggle}
                hiddenFrom="sm"
                size="sm"
              />
              <Title order={3}><Link to="homepage" style={{ color: 'inherit', textDecoration: 'none' }}>
                Hydro
              </Link></Title>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">
                {data.name}
              </Text>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="md">
          <Stack gap={4}>
            <NavItem
              icon={<Text span fw={700}>H</Text>}
              label="Home"
              to="homepage"
              active={data.name === "homepage"}
            />
            <NavItem
              icon={<Text span fw={700}>{"</>"}</Text>}
              label="Problems"
              to="problem_main"
              active={data.name?.startsWith("problem")}
            />
            <NavItem
              icon={<Text span fw={700}>T</Text>}
              label="Contests"
              to="contest_main"
              active={data.name?.startsWith("contest")}
            />
            <NavItem
              icon={<Text span fw={700}>R</Text>}
              label="Records"
              to="record_main"
              active={data.name?.startsWith("record")}
            />
            <NavItem
              icon={<Text span fw={700}>D</Text>}
              label="Discussion"
              to="discussion_main"
              active={data.name?.startsWith("discussion")}
            />
            <NavItem
              icon={<Text span fw={700}>S</Text>}
              label="Settings"
              to="home_settings"
              active={data.name === "home_settings"}
            />
          </Stack>
        </AppShell.Navbar>

        <AppShell.Main>
          <Container size="xl" py="md">
            <div>Page: {data.name}</div>
          </Container>
        </AppShell.Main>

        <AppShell.Footer>
          <Container size="xl" py="xs">
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Powered by Hydro
              </Text>
              <Text size="xs" c="dimmed">
                {new Date().getFullYear()}
              </Text>
            </Group>
          </Container>
        </AppShell.Footer>
      </AppShell>
    </MantineProvider>
  );
});

export default AppInner;
