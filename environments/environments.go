package environments

import (
	"errors"
	"os/exec"
	"sort"
	"sync"

	"github.com/airware/vili/kube"
	"github.com/airware/vili/log"
	"github.com/airware/vili/templates"
	"github.com/airware/vili/util"
)

var environments map[string]Environment
var rwMutex sync.RWMutex

// Environment describes an environment backed by a kubernetes namespace
type Environment struct {
	Name        string   `json:"name"`
	Branch      string   `json:"branch,omitempty"`
	Protected   bool     `json:"protected,omitempty"`
	Prod        bool     `json:"prod,omitempty"`
	Approval    bool     `json:"approval,omitempty"`
	Deployments []string `json:"deployments"`
	Jobs        []string `json:"jobs,omitempty"`
}

// Init initializes the global environments list
func Init(envs []Environment) {
	rwMutex.Lock()
	environments = make(map[string]Environment)
	for _, env := range envs {
		environments[env.Name] = env
	}
	rwMutex.Unlock()
}

// Environments returns a snapshot of all of the known environments
func Environments() (ret []Environment) {
	rwMutex.RLock()
	for _, env := range environments {
		ret = append(ret, env)
	}
	rwMutex.RUnlock()
	sort.Sort(byProtectedAndName(ret))
	return
}

// Get returns the environment with `name`
func Get(name string) (Environment, error) {
	rwMutex.RLock()
	defer rwMutex.RUnlock()
	env, ok := environments[name]
	if !ok {
		return Environment{}, errors.New(name + " not found")
	}
	return env, nil
}

// Create creates a new environment with `name`
func Create(name, branch, spec string) (map[string][]string, error) {
	resources, err := kube.Create(spec)
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, errors.New(string(exitErr.Stderr))
		}
		return nil, err
	}

	env := Environment{
		Name:   name,
		Branch: branch,
	}

	env.Deployments, err = templates.Deployments(name, branch)
	if err != nil {
		return nil, err
	}

	rwMutex.Lock()
	environments[name] = env
	rwMutex.Unlock()
	return resources, nil
}

// Delete deletes the environment with `name`
func Delete(name string) error {
	rwMutex.Lock()
	defer rwMutex.Unlock()

	env, ok := environments[name]
	if !ok {
		return errors.New(name + " not found")
	} else if env.Protected {
		return errors.New(name + " is a protected environment")
	}

	status, err := kube.Namespaces.Delete(name)
	if err != nil {
		return err
	}
	if status != nil {
		return errors.New(status.Message)
	}

	delete(environments, name)
	return nil
}

// RefreshEnvs refreshes the list of environments as detected from the kubernetes cluster
func RefreshEnvs() error {
	namespaceList, _, err := kube.Namespaces.List(nil)
	if err != nil {
		return err
	}

	newEnvs := make(map[string]Environment)
	rwMutex.Lock()
	defer rwMutex.Unlock()
	for name, env := range environments {
		if env.Protected {
			newEnvs[name] = env
		}
	}

	// Load environments from namespaces, add branch metadata
	for _, namespace := range namespaceList.Items {
		if namespace.Name != "kube-system" && namespace.Name != "default" && namespace.Status.Phase != "Terminating" {
			env, ok := newEnvs[namespace.Name]
			if ok {
				env.Branch = namespace.Annotations["vili.environment-branch"]
			} else {
				env = Environment{
					Name:   namespace.Name,
					Branch: namespace.Annotations["vili.environment-branch"],
				}
			}
			newEnvs[namespace.Name] = env
		}
	}

	var wg sync.WaitGroup
	var mapLock sync.Mutex

	// Load deployments and jobs from template files
	for _, env := range newEnvs {
		wg.Add(1)
		go func(name, branch string) {
			defer wg.Done()
			jobs, err := templates.Jobs(name, branch)
			if err != nil {
				log.Error(err)
				return
			}
			deployments, err := templates.Deployments(name, branch)
			if err != nil {
				log.Error(err)
				return
			}
			mapLock.Lock()
			e := newEnvs[name]
			e.Deployments = deployments
			e.Jobs = jobs
			newEnvs[name] = e
			mapLock.Unlock()
		}(env.Name, env.Branch)
	}

	wg.Wait()
	environments = newEnvs
	return nil
}

// RepositoryBranches returns the list of repository branches for this environment
func (e Environment) RepositoryBranches() (branches []string) {
	if e.Prod || e.Approval {
		branches = append(branches, "master")
	} else {
		branches = append(branches, "develop")
		if e.Branch != "" && !util.NewStringSet(branches).Contains(e.Branch) {
			branches = append(branches, e.Branch)
		}
	}
	return
}

type byProtectedAndName []Environment

// Len implements the sort interface
func (e byProtectedAndName) Len() int {
	return len(e)
}

// Less implements the sort interface
func (e byProtectedAndName) Less(i, j int) bool {
	if e[i].Protected != e[j].Protected {
		return e[i].Protected
	}
	return e[i].Name < e[j].Name
}

// Swap implements the sort interface
func (e byProtectedAndName) Swap(i, j int) {
	e[i], e[j] = e[j], e[i]
}
