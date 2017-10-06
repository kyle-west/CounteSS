'use babel';

import CounteSS from './countess-sys';
// import CountessView from './countess-view';
import { CompositeDisposable } from 'atom';

export default {

  countessView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    // this.countessView = new CountessView(state.countessViewState);
    // this.modalPanel = atom.workspace.addModalPanel({
    //   item: this.countessView.getElement(),
    //   visible: false
    // });

    this.countess = new CounteSS();
    this.isActive = false;

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'countess:toggle': () => this.toggle()
    }));

    this.countess.editor.getBuffer().onDidStopChanging(this.live.bind(this));
  },

  deactivate() {
    // this.modalPanel.destroy();
    this.subscriptions.dispose();
    // this.countessView.destroy();
  },

  serialize() {
    // return {
    //   countessViewState: this.countessView.serialize()
    // };
  },

  live () {
    if (this.isActive) {
      this.countess.removeAnnotations();
      this.countess.analyze();
    }
  },

  toggle() {

    this.isActive = !this.isActive;
    if (this.isActive) {
      console.log('CounteSS is ACTIVE');
      this.countess.analyze();
    } else {
      this.countess.removeAnnotations();
      console.log('CounteSS is INACTIVE');
    }

    // return (
    //   this.modalPanel.isVisible() ?
    //   this.modalPanel.hide() :
    //   this.modalPanel.show()
    // );
  }

};
