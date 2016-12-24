package api

// // deployer
// type deployerSpec struct {
// 	rollout *Rollout
// 	db      *firego.Firebase

// 	// for all actions
// 	fromReplicaSet *v1beta1.ReplicaSet
// 	toReplicaSet   *v1beta1.ReplicaSet

// 	// for resume
// 	deploymentTemplate templates.Template
// 	variables          map[string]string
// 	lastPing           time.Time
// }

// func makeDeployer(rollout *Rollout) (*deployerSpec, error) {
// 	deployer := &deployerSpec{
// 		rollout:  rollout,
// 		db:       rolloutDB(rollout.Env, rollout.Deployment, rollout.ID),
// 		lastPing: time.Now(),
// 	}
// 	replicaSetList, _, err := kube.ReplicaSets.List(rollout.Env, &url.Values{
// 		"labelSelector": []string{"app=" + rollout.Deployment},
// 	})
// 	if err != nil {
// 		return nil, err
// 	}

// 	// if replicaSetList != nil {
// 	// 	for _, replicaSet := range replicaSetList.Items {
// 	// 		if string(replicaSet.ObjectMeta.UID) == rollout.FromUID {
// 	// 			fromReplicaSet := replicaSet
// 	// 			deployer.fromReplicaSet = &fromReplicaSet
// 	// 		}
// 	// 		if string(replicaSet.ObjectMeta.UID) == rollout.ToUID {
// 	// 			toReplicaSet := replicaSet
// 	// 			deployer.toReplicaSet = &toReplicaSet
// 	// 		}
// 	// 	}
// 	// }

// 	// if rollout.FromUID != "" && deployer.fromReplicaSet == nil && deployer.toReplicaSet == nil {
// 	// 	log.Warn("Could not find any replica sets for this deployment")
// 	// }

// 	return deployer, nil
// }

// func (d *deployerSpec) addMessage(message, level string) error {
// 	var logf func(...interface{})
// 	switch level {
// 	case "debug":
// 		logf = log.Debug
// 	case "info":
// 		logf = log.Info
// 	case "warn":
// 		logf = log.Warn
// 	case "error":
// 		logf = log.Error
// 	default:
// 		return fmt.Errorf("Invalid level %s", level)
// 	}
// 	logf(message)
// 	_, err := d.db.Child("log").Push(LogMessage{
// 		Time:    time.Now(),
// 		Message: message,
// 		Level:   level,
// 	})
// 	if err != nil {
// 		return err
// 	}

// 	if level != "debug" {
// 		urlStr := fmt.Sprintf(
// 			"%s/%s/deployments/%s/rollouts/%s",
// 			config.GetString(config.URI),
// 			d.rollout.Env,
// 			d.rollout.Deployment,
// 			d.rollout.ID,
// 		)
// 		slackMessage := fmt.Sprintf(
// 			"*%s* - *%s* - <%s|%s> - %s",
// 			d.rollout.Env,
// 			d.rollout.Deployment,
// 			urlStr,
// 			d.rollout.ID,
// 			message,
// 		)
// 		if level == "error" {
// 			slackMessage += " <!channel>"
// 		}
// 		err := slack.PostLogMessage(slackMessage, level)
// 		if err != nil {
// 			return err
// 		}
// 	}
// 	return nil
// }

// func (d *deployerSpec) resume() error {
// 	log.Infof("Resuming rollout %s for deployment %s in env %s", d.rollout.ID, d.rollout.Deployment, d.rollout.Env)

// 	body, err := templates.Deployment(d.rollout.Env, d.rollout.Branch, d.rollout.Deployment)
// 	if err != nil {
// 		return err
// 	}
// 	d.deploymentTemplate = body

// 	deployment := &v1beta1.Deployment{}
// 	err = d.deploymentTemplate.Parse(deployment)
// 	if err != nil {
// 		return err
// 	}

// 	deployment.Spec.Template.ObjectMeta.Labels["rollout"] = d.rollout.ID

// 	imageName, err := docker.FullName(d.rollout.Deployment, d.rollout.Branch, d.rollout.Tag)
// 	if err != nil {
// 		return err
// 	}
// 	deployment.Spec.Template.Spec.Containers[0].Image = imageName

// 	// return any lock errors synchronously
// 	if err := d.acquireLock(); err != nil {
// 		return err
// 	}

// 	// if no problem fetching lock, run the rollout asynchronously
// 	go func() {
// 		defer d.releaseLock()

// 		var state string
// 		d.db.Child("state").Value(&state)
// 		var message string
// 		switch state {
// 		case rolloutStateNew:
// 			message = fmt.Sprintf("Starting rollout created by *%s* for tag *%s* on branch *%s*", d.rollout.Username, d.rollout.Tag, d.rollout.Branch)
// 		case rolloutStatePaused:
// 			message = "Resuming rollout"
// 		default:
// 			log.Errorf("Cannot resume deployment from state %s", state)
// 			return
// 		}
// 		d.db.Child("state").Set(rolloutStateRunning)
// 		d.rollout.State = rolloutStateRunning
// 		d.addMessage(message, "info")

// 		// fetch the latest pods for the fromReplicaSet
// 		if d.fromReplicaSet != nil {
// 			if _, _, err := d.refreshReplicaSetPodCount(d.fromReplicaSet); err != nil {
// 				log.Error(err)
// 				return
// 			}
// 		}

// 		newDeployment, _, err := kube.Deployments.Replace(d.rollout.Env, d.rollout.Deployment, deployment)
// 		if err != nil {
// 			log.Error(err)
// 			return
// 		}

// 		if newDeployment == nil {
// 			newDeployment, _, err = kube.Deployments.Create(d.rollout.Env, deployment)
// 			if err != nil {
// 				log.Error(err)
// 				return
// 			}
// 		}

// 		// It can take some time for kubernetes to populate the revision annotation
// 		for {
// 			if _, ok := newDeployment.ObjectMeta.Annotations["deployment.kubernetes.io/revision"]; ok {
// 				break
// 			}
// 			time.Sleep(100 * time.Millisecond)
// 			newDeployment, _, err = kube.Deployments.Get(d.rollout.Env, d.rollout.Deployment)
// 			if err != nil {
// 				log.Error(err)
// 				return
// 			}
// 		}

// 		replicaSetList, _, err := kube.ReplicaSets.ListForDeployment(d.rollout.Env, newDeployment)
// 		if err != nil {
// 			log.Error(err)
// 			return
// 		}
// 		newRevision, ok := newDeployment.ObjectMeta.Annotations["deployment.kubernetes.io/revision"]
// 		if !ok {
// 			log.Error("No revision annotation found on the new deployment")
// 			return
// 		}
// 		var toReplicaSet *v1beta1.ReplicaSet
// 		if replicaSetList != nil {
// 			for _, replicaSet := range replicaSetList.Items {
// 				revision := replicaSet.ObjectMeta.Annotations["deployment.kubernetes.io/revision"]
// 				if revision == newRevision {
// 					toReplicaSet = &replicaSet
// 					break
// 				}
// 			}
// 		}
// 		if toReplicaSet == nil {
// 			log.Error("Unable to find new replica set")
// 			return
// 		}
// 		if d.toReplicaSet == nil || d.toReplicaSet.ObjectMeta.UID != toReplicaSet.ObjectMeta.UID {
// 			d.addMessage(fmt.Sprintf("Created new replica set: %s", toReplicaSet.ObjectMeta.Name), "debug")
// 		}
// 		d.toReplicaSet = toReplicaSet
// 		d.db.Child("toUid").Set(toReplicaSet.ObjectMeta.UID)
// 		// d.rollout.ToUID = string(toReplicaSet.ObjectMeta.UID)

// 		stateNotifications := make(chan firego.Event)
// 		stateRef := d.db.Child("state")
// 		if err := stateRef.Watch(stateNotifications); err != nil {
// 			log.Error(err)
// 			return
// 		}
// 		defer stateRef.StopWatching()
// 		go func() {
// 			for event := range stateNotifications {
// 				log.Debugf("Deployment state changed to %s", event.Data.(string))
// 				d.rollout.State = event.Data.(string)
// 			}
// 		}()

// 		rolloutErr := d.monitorRollout()
// 		if rolloutErr != nil {
// 			deployment, _, err := kube.Deployments.Get(d.rollout.Env, d.rollout.Deployment)
// 			if err != nil {
// 				log.Error(err)
// 				return
// 			}
// 			if deployment != nil {
// 				deployment.Spec.Paused = true
// 				_, _, err = kube.Deployments.Replace(d.rollout.Env, d.rollout.Deployment, deployment)
// 				if err != nil {
// 					log.Error(err)
// 					return
// 				}
// 			}
// 			d.db.Child("state").Set(rolloutStatePaused)
// 			switch e := rolloutErr.(type) {
// 			case deployerPaused:
// 				d.addMessage("Paused deployment", "warn")
// 			case deployerAutoPaused:
// 				// pass
// 			case *deployerTimeout:
// 				d.addMessage(e.message, "error")
// 			default:
// 				log.Error(rolloutErr)
// 			}
// 		}
// 	}()
// 	return nil
// }

// func (d *deployerSpec) pause() error {
// 	log.Infof("Pausing rollout %s for deployment %s in env %s", d.rollout.ID, d.rollout.Deployment, d.rollout.Env)
// 	var state string
// 	var newState string
// 	d.db.Child("state").Value(&state)
// 	var message string
// 	switch state {
// 	case rolloutStateRunning:
// 		message = "Pausing rollout"
// 		newState = rolloutStatePausing
// 	case rolloutStatePausing:
// 		message = "Force pausing rollout"
// 		newState = rolloutStatePaused
// 	default:
// 		return errors.BadRequestError(fmt.Sprintf("Cannot pause rollout from state %s", state))
// 	}
// 	d.db.Child("state").Set(newState)
// 	d.addMessage(message, "warn")
// 	return nil
// }

// func (d *deployerSpec) rollback() error {
// 	log.Infof("Rolling back rollout %s for deployment %s in env %s", d.rollout.ID, d.rollout.Deployment, d.rollout.Env)
// 	if err := d.acquireLock(); err != nil {
// 		return err
// 	}
// 	defer d.releaseLock()

// 	var state string
// 	var newState string
// 	d.db.Child("state").Value(&state)
// 	var message string
// 	switch state {
// 	case rolloutStatePaused, rolloutStateCompleted:
// 		message = "Rolling back rollout"
// 		newState = rolloutStateRollingback
// 	default:
// 		return errors.BadRequestError(fmt.Sprintf("Cannot roll back rollout from state %s", state))
// 	}
// 	d.db.Child("state").Set(newState)
// 	d.rollout.State = newState
// 	d.addMessage(message, "warn")

// 	deployment, _, err := kube.Deployments.Get(d.rollout.Env, d.rollout.Deployment)
// 	if err != nil {
// 		return err
// 	}
// 	if deployment.Spec.Paused {
// 		deployment.Spec.Paused = false
// 		_, _, err := kube.Deployments.Replace(d.rollout.Env, d.rollout.Deployment, deployment)
// 		if err != nil {
// 			return err
// 		}
// 	}

// 	if d.fromReplicaSet != nil && d.toReplicaSet != nil {
// 		fromRevision, ok := d.fromReplicaSet.ObjectMeta.Annotations["deployment.kubernetes.io/revision"]
// 		if !ok {
// 			return errors.New("Unable to determine previous deployment revision")
// 		}
// 		rollbackTo, err := strconv.ParseInt(fromRevision, 10, 0)
// 		if err != nil {
// 			return err
// 		}
// 		rollback := v1beta1.DeploymentRollback{
// 			Name: d.rollout.Deployment,
// 			RollbackTo: v1beta1.RollbackConfig{
// 				Revision: rollbackTo,
// 			},
// 		}
// 		if _, _, err := kube.Deployments.Rollback(d.rollout.Env, d.rollout.Deployment, &rollback); err != nil {
// 			return err
// 		}
// 	} else {
// 		log.Warn("Cannot roll back deployment with no from or to replica set")
// 	}
// 	d.db.Child("state").Set(rolloutStateRolledback)
// 	d.addMessage("Rolled back deployment", "warn")
// 	return nil
// }

// // utils
// func (d *deployerSpec) monitorRollout() error {
// 	for {
// 		readyCount, runningCount, err := d.refreshReplicaSetPodCount(d.toReplicaSet)
// 		if err != nil {
// 			return err
// 		}
// 		fromRunningCount := 0
// 		if d.fromReplicaSet != nil {
// 			_, fromRunningCount, _ = d.refreshReplicaSetPodCount(d.fromReplicaSet)
// 		}
// 		log.Debugf("%s Replica Count: Ready: %v, Running: %v", d.rollout.Deployment, readyCount, runningCount)
// 		// TODO
// 		// if readyCount == d.rollout.DesiredReplicas && fromRunningCount == 0 {
// 		// 	d.addMessage(fmt.Sprintf("Successfully completed rollout in %s", d.rollout.Clock.humanize()), "info")
// 		// 	d.db.Child("state").Set(rolloutStateCompleted)
// 		// 	return nil
// 		// }
// 		if err := d.ping(); err != nil {
// 			return err
// 		}
// 		time.Sleep(250 * time.Millisecond)
// 	}
// }

// func (d *deployerSpec) acquireLock() error {
// 	locked, err := redis.GetClient().SetNX(
// 		fmt.Sprintf("rolloutlock:%s:%s", d.rollout.Env, d.rollout.Deployment),
// 		true,
// 		1*time.Hour,
// 	).Result()
// 	if err != nil {
// 		return err
// 	}
// 	if !locked {
// 		return errors.ConflictError("Failed to acquire rollout lock")
// 	}
// 	log.Debugf("Acquired lock for %s in %s", d.rollout.Deployment, d.rollout.Env)
// 	WaitGroup.Add(1)
// 	return nil
// }

// func (d *deployerSpec) releaseLock() {
// 	WaitGroup.Done()
// 	err := redis.GetClient().Del(
// 		fmt.Sprintf("rolloutlock:%s:%s", d.rollout.Env, d.rollout.Deployment),
// 	).Err()
// 	if err != nil {
// 		log.Error(err)
// 	} else {
// 		log.Debugf("Released lock for %s in %s", d.rollout.Deployment, d.rollout.Env)
// 	}
// }

// // ping updates the deployment clock, and checks if the deployment should be paused
// func (d *deployerSpec) ping() error {
// 	now := time.Now()
// 	elapsed := Clock(now.Sub(d.lastPing))
// 	// if d.rollout.Clock == nil {
// 	// 	d.rollout.Clock = &elapsed
// 	// } else {
// 	// 	*d.rollout.Clock += elapsed
// 	// }
// 	// d.lastPing = now
// 	// d.db.Child("clock").Set(d.rollout.Clock)

// 	if d.rollout.State == rolloutStatePausing ||
// 		d.rollout.State == rolloutStatePaused {
// 		return deployerPaused{}
// 	}
// 	select {
// 	case <-ExitingChan:
// 		log.Warn("Pausing deployment after server shutdown request")
// 		return deployerPaused{}
// 	default:
// 		return nil
// 	}
// }

// func (d *deployerSpec) refreshReplicaSetPodCount(replicaSet *v1beta1.ReplicaSet) (int, int, error) {
// 	kubePods, status, err := kube.Pods.ListForReplicaSet(d.rollout.Env, replicaSet)
// 	if err != nil {
// 		return 0, 0, err
// 	}
// 	if status != nil {
// 		return 0, 0, fmt.Errorf("Could not fetch the list of pods for replica set %s", replicaSet.ObjectMeta.Name)
// 	}
// 	pods, readyCount, runningCount := getPodsFromPodList(kubePods)

// 	// if string(replicaSet.ObjectMeta.UID) == d.rollout.FromUID {
// 	// 	d.db.Child("fromPods").Set(pods)
// 	// } else if string(replicaSet.ObjectMeta.UID) == d.rollout.ToUID {
// 	// 	d.db.Child("toPods").Set(pods)
// 	// }

// 	return readyCount, runningCount, nil
// }

// type deployerException struct {
// }

// func (e *deployerException) Error() string {
// 	return "Deployer exception"
// }

// type deployerPaused struct {
// 	*deployerException
// }

// type deployerAutoPaused struct {
// 	*deployerException
// }

// type deployerTimeout struct {
// 	message string
// }

// func (e *deployerTimeout) Error() string {
// 	return e.message
// }
